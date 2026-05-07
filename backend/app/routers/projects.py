"""Projects: user-owned namespaces.

Each project groups one or more ad accounts and the agents that watch
them.  Free-tier users get 1 project; paid tiers get N.
"""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select

from app.core.database import UserDB
from app.middleware.auth import CurrentUser
from app.middleware.rate_limit import limiter
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectListResponse, ProjectOut
from app.services import audit, events

router = APIRouter(prefix="/projects", tags=["projects"])
logger = logging.getLogger("projects")


@router.get("", response_model=ProjectListResponse)
async def list_projects(user: CurrentUser, db: UserDB) -> ProjectListResponse:
    rows = (
        await db.execute(
            select(Project)
            .where(Project.archived_at.is_(None))
            .order_by(Project.created_at.desc())
        )
    ).scalars().all()
    return ProjectListResponse(projects=[ProjectOut.model_validate(r) for r in rows])


@router.post("", response_model=ProjectOut, status_code=201)
@limiter.limit("30/minute")
async def create_project(
    request: Request,
    payload: ProjectCreate,
    user: CurrentUser,
    db: UserDB,
) -> ProjectOut:
    project = Project(user_id=user.id, name=payload.name.strip())
    db.add(project)
    await db.flush()

    await audit.log(
        action=audit.Action.PROJECT_CREATED,
        request=request,
        user=user,
        resource_type="project",
        resource_id=project.id,
    )
    await events.emit(
        db,
        name=events.EventName.PROJECT_CREATED,
        user_id=user.id,
        subject_type="project",
        subject_id=project.id,
        payload={"name": project.name},
    )
    return ProjectOut.model_validate(project)


@router.delete("/{project_id}", status_code=204)
async def archive_project(
    request: Request,
    project_id: uuid.UUID,
    user: CurrentUser,
    db: UserDB,
):
    project = (
        await db.execute(select(Project).where(Project.id == project_id))
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="project_not_found")

    from datetime import datetime, timezone

    project.archived_at = datetime.now(timezone.utc)
    await db.flush()

    await audit.log(
        action=audit.Action.PROJECT_DELETED,
        request=request,
        user=user,
        resource_type="project",
        resource_id=project.id,
    )
