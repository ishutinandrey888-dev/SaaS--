"""Agents: create, configure, launch, inspect findings."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select

from app.core.database import UserDB
from app.middleware.auth import CurrentUser
from app.middleware.rate_limit import limiter
from app.models.agent import Agent
from app.models.ai_run import AiRun
from app.models.audit_finding import AuditFinding
from app.models.project import Project
from app.schemas.agent import (
    AgentCreate,
    AgentListResponse,
    AgentOut,
    AgentPatch,
    FindingListResponse,
    FindingOut,
    RunListResponse,
    RunOut,
)
from app.services import audit, events

router = APIRouter(prefix="/agents", tags=["agents"])
logger = logging.getLogger("agents")


# ---------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------
@router.get("", response_model=AgentListResponse)
async def list_agents(user: CurrentUser, db: UserDB) -> AgentListResponse:
    rows = (
        await db.execute(
            select(Agent)
            .where(Agent.status != "archived")
            .order_by(Agent.created_at.desc())
        )
    ).scalars().all()
    return AgentListResponse(agents=[AgentOut.model_validate(a) for a in rows])


@router.post("", response_model=AgentOut, status_code=201)
@limiter.limit("30/minute")
async def create_agent(
    request: Request,
    payload: AgentCreate,
    user: CurrentUser,
    db: UserDB,
) -> AgentOut:
    project = (
        await db.execute(
            select(Project).where(Project.id == payload.project_id)
        )
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="project_not_found")

    agent = Agent(
        project_id=payload.project_id,
        user_id=user.id,
        name=payload.name.strip(),
        mode=payload.mode,
        status="draft",
        brief=payload.brief.model_dump(exclude_none=True),
        kpi=payload.kpi.model_dump(exclude_none=True),
        ad_account_ids=[str(x) for x in payload.ad_account_ids],
    )
    db.add(agent)
    await db.flush()

    await audit.log(
        action=audit.Action.AGENT_CREATED,
        request=request,
        user=user,
        resource_type="agent",
        resource_id=agent.id,
    )
    await events.emit(
        db,
        name=events.EventName.AGENT_CREATED,
        user_id=user.id,
        subject_type="agent",
        subject_id=agent.id,
        payload={"mode": agent.mode},
    )
    return AgentOut.model_validate(agent)


@router.patch("/{agent_id}", response_model=AgentOut)
async def patch_agent(
    agent_id: uuid.UUID,
    payload: AgentPatch,
    user: CurrentUser,
    db: UserDB,
) -> AgentOut:
    agent = await _get_agent_or_404(db, agent_id)
    if payload.name is not None:
        agent.name = payload.name.strip()
    if payload.mode is not None:
        agent.mode = payload.mode
    if payload.brief is not None:
        agent.brief = payload.brief.model_dump(exclude_none=True)
    if payload.kpi is not None:
        agent.kpi = payload.kpi.model_dump(exclude_none=True)
    if payload.ad_account_ids is not None:
        agent.ad_account_ids = [str(x) for x in payload.ad_account_ids]
    await db.flush()
    return AgentOut.model_validate(agent)


# ---------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------
@router.post("/{agent_id}/launch", response_model=AgentOut)
@limiter.limit("10/minute")
async def launch_agent(
    request: Request,
    agent_id: uuid.UUID,
    user: CurrentUser,
    db: UserDB,
) -> AgentOut:
    agent = await _get_agent_or_404(db, agent_id)
    if not agent.ad_account_ids:
        raise HTTPException(status_code=400, detail="agent_needs_ad_account")
    agent.status = "active"
    agent.next_run_at = datetime.now(timezone.utc)
    await db.flush()

    await audit.log(
        action=audit.Action.AGENT_LAUNCHED,
        request=request,
        user=user,
        resource_type="agent",
        resource_id=agent.id,
    )
    await events.emit(
        db,
        name=events.EventName.AGENT_LAUNCHED,
        user_id=user.id,
        subject_type="agent",
        subject_id=agent.id,
        payload={"mode": agent.mode},
    )

    # Kick off a run in the background.  We delay the celery dispatch
    # to a separate task; importing here avoids a circular at module
    # load (agent_runner imports the engine session).
    from app.tasks.agent_tasks import run_agent_task

    run_agent_task.delay(str(agent.id))

    return AgentOut.model_validate(agent)


@router.post("/{agent_id}/pause", response_model=AgentOut)
async def pause_agent(
    request: Request,
    agent_id: uuid.UUID,
    user: CurrentUser,
    db: UserDB,
) -> AgentOut:
    agent = await _get_agent_or_404(db, agent_id)
    agent.status = "paused"
    agent.next_run_at = None
    await db.flush()

    await audit.log(
        action=audit.Action.AGENT_PAUSED,
        request=request,
        user=user,
        resource_type="agent",
        resource_id=agent.id,
    )
    await events.emit(
        db,
        name=events.EventName.AGENT_PAUSED,
        user_id=user.id,
        subject_type="agent",
        subject_id=agent.id,
    )
    return AgentOut.model_validate(agent)


@router.post("/{agent_id}/run", response_model=AgentOut)
@limiter.limit("10/minute")
async def trigger_run(
    request: Request,
    agent_id: uuid.UUID,
    user: CurrentUser,
    db: UserDB,
) -> AgentOut:
    agent = await _get_agent_or_404(db, agent_id)
    from app.tasks.agent_tasks import run_agent_task

    run_agent_task.delay(str(agent.id))
    return AgentOut.model_validate(agent)


# ---------------------------------------------------------------------
# Reads: runs + findings
# ---------------------------------------------------------------------
@router.get("/{agent_id}/runs", response_model=RunListResponse)
async def list_runs(
    agent_id: uuid.UUID, user: CurrentUser, db: UserDB
) -> RunListResponse:
    rows = (
        await db.execute(
            select(AiRun)
            .where(AiRun.agent_id == agent_id)
            .order_by(AiRun.started_at.desc())
            .limit(50)
        )
    ).scalars().all()
    return RunListResponse(runs=[RunOut.model_validate(r) for r in rows])


@router.get("/{agent_id}/findings", response_model=FindingListResponse)
async def list_findings(
    agent_id: uuid.UUID, user: CurrentUser, db: UserDB
) -> FindingListResponse:
    rows = (
        await db.execute(
            select(AuditFinding)
            .where(AuditFinding.agent_id == agent_id)
            .order_by(AuditFinding.created_at.desc())
            .limit(200)
        )
    ).scalars().all()
    return FindingListResponse(findings=[FindingOut.model_validate(f) for f in rows])


# ---------------------------------------------------------------------
# Finding actions
# ---------------------------------------------------------------------
@router.post("/findings/{finding_id}/approve", response_model=FindingOut)
async def approve_finding(
    request: Request,
    finding_id: uuid.UUID,
    user: CurrentUser,
    db: UserDB,
) -> FindingOut:
    finding = await _get_finding_or_404(db, finding_id)
    if finding.state not in {"new", "rejected"}:
        return FindingOut.model_validate(finding)
    finding.state = "approved"
    await db.flush()

    await audit.log(
        action=audit.Action.AGENT_FINDING_APPROVED,
        request=request,
        user=user,
        resource_type="finding",
        resource_id=finding.id,
    )
    await events.emit(
        db,
        name=events.EventName.FINDING_APPROVED,
        user_id=user.id,
        subject_type="finding",
        subject_id=finding.id,
    )

    # Hand off application to the runner — keeps this endpoint fast.
    from app.tasks.agent_tasks import apply_finding_task

    apply_finding_task.delay(str(finding.id))

    return FindingOut.model_validate(finding)


@router.post("/findings/{finding_id}/reject", response_model=FindingOut)
async def reject_finding(
    request: Request,
    finding_id: uuid.UUID,
    user: CurrentUser,
    db: UserDB,
) -> FindingOut:
    finding = await _get_finding_or_404(db, finding_id)
    finding.state = "rejected"
    await db.flush()

    await audit.log(
        action=audit.Action.AGENT_FINDING_REJECTED,
        request=request,
        user=user,
        resource_type="finding",
        resource_id=finding.id,
    )
    await events.emit(
        db,
        name=events.EventName.FINDING_REJECTED,
        user_id=user.id,
        subject_type="finding",
        subject_id=finding.id,
    )
    return FindingOut.model_validate(finding)


# ---------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------
async def _get_agent_or_404(db, agent_id: uuid.UUID) -> Agent:
    agent = (
        await db.execute(select(Agent).where(Agent.id == agent_id))
    ).scalar_one_or_none()
    if agent is None:
        raise HTTPException(status_code=404, detail="agent_not_found")
    return agent


async def _get_finding_or_404(db, finding_id: uuid.UUID) -> AuditFinding:
    finding = (
        await db.execute(
            select(AuditFinding).where(AuditFinding.id == finding_id)
        )
    ).scalar_one_or_none()
    if finding is None:
        raise HTTPException(status_code=404, detail="finding_not_found")
    return finding
