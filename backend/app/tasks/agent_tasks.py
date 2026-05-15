"""Celery tasks: agent runs + finding application."""

from __future__ import annotations

import asyncio
import logging
import uuid

from sqlalchemy import select

from app.core.database import AsyncSessionAdmin
from app.models.audit_finding import AuditFinding
from app.services import agent_runner
from app.tasks.celery_app import celery_app

logger = logging.getLogger("agent_tasks")


def _run_async(coro):
    """Run an async coroutine inside a Celery worker.

    Each task gets a fresh event loop — avoids polluting state if the
    worker concurrency model is prefork.
    """
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(name="agent.run", bind=True, max_retries=2, default_retry_delay=30)
def run_agent_task(self, agent_id: str) -> str:
    try:
        run_id = _run_async(agent_runner.run(uuid.UUID(agent_id)))
        return str(run_id)
    except Exception as exc:  # noqa: BLE001
        logger.exception("agent_run_task_failed agent_id=%s", agent_id)
        raise self.retry(exc=exc)


@celery_app.task(name="agent.apply_finding", bind=True, max_retries=2, default_retry_delay=30)
def apply_finding_task(self, finding_id: str) -> bool:
    """Apply a single approved finding (called from the assistant flow)."""
    try:
        return _run_async(_apply_finding(uuid.UUID(finding_id)))
    except Exception as exc:  # noqa: BLE001
        logger.exception("apply_finding_task_failed finding_id=%s", finding_id)
        raise self.retry(exc=exc)


async def _apply_finding(finding_id: uuid.UUID) -> bool:
    from datetime import datetime, timezone

    from app.models.ad_account import AdAccount

    async with AsyncSessionAdmin() as session:
        async with session.begin():
            finding = (
                await session.execute(
                    select(AuditFinding).where(AuditFinding.id == finding_id)
                )
            ).scalar_one_or_none()
            if finding is None or finding.state != "approved":
                return False

            accounts = (
                await session.execute(
                    select(AdAccount).where(AdAccount.user_id == finding.user_id)
                )
            ).scalars().all()

    ok = await agent_runner._try_apply(  # noqa: SLF001 — internal helper reuse
        finding={
            "suggested_action": finding.suggested_action,
        },
        accounts=accounts,
    )

    async with AsyncSessionAdmin() as session:
        async with session.begin():
            finding = (
                await session.execute(
                    select(AuditFinding).where(AuditFinding.id == finding_id)
                )
            ).scalar_one()
            if ok:
                finding.state = "applied"
                finding.applied_at = datetime.now(timezone.utc)
                finding.kind = "applied"
    return ok


@celery_app.task(name="agent.tick")
def agent_tick() -> int:
    """Find active agents whose next_run_at has passed and dispatch runs."""
    return _run_async(_tick())


async def _tick() -> int:
    from datetime import datetime, timezone

    from app.models.agent import Agent

    now = datetime.now(timezone.utc)
    dispatched = 0
    async with AsyncSessionAdmin() as session:
        async with session.begin():
            rows = (
                await session.execute(
                    select(Agent).where(
                        Agent.status == "active",
                        Agent.next_run_at.is_not(None),
                        Agent.next_run_at <= now,
                    )
                )
            ).scalars().all()

            for agent in rows:
                run_agent_task.delay(str(agent.id))
                # Schedule next run 24h out (Pro / Free) — 6h for Agency
                # could be added once we read users.plan inline.
                from datetime import timedelta

                agent.next_run_at = now + timedelta(hours=24)
                dispatched += 1
    return dispatched
