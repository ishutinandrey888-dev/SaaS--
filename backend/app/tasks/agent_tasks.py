"""Celery tasks: agent runs + finding application."""

from __future__ import annotations

import asyncio
import uuid
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import func
from sqlalchemy import select

from app.core.config import get_settings
from app.core.database import AsyncSessionAdmin
from app.models.admin_ops import AiUsageDaily, FeedbackItem, ProductAgentRun
from app.models.audit_finding import AuditFinding
from app.models.ad_account import AdAccount
from app.models.agent import Agent
from app.services import agent_runner, telegram
from app.tasks.celery_app import celery_app

logger = logging.getLogger("agent_tasks")


# ---------------------------
# Async runner for Celery
# ---------------------------

def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


# ---------------------------
# Agent execution
# ---------------------------

@celery_app.task(name="agent.run", bind=True, max_retries=2, default_retry_delay=30)
def run_agent_task(self, agent_id: str) -> str:
    try:
        run_id = _run_async(agent_runner.run(uuid.UUID(agent_id)))
        return str(run_id)
    except Exception as exc:
        logger.exception("agent_run_task_failed agent_id=%s", agent_id)
        raise self.retry(exc=exc)


# ---------------------------
# Apply finding
# ---------------------------

@celery_app.task(name="agent.apply_finding", bind=True, max_retries=2, default_retry_delay=30)
def apply_finding_task(self, finding_id: str) -> bool:
    try:
        return _run_async(_apply_finding(uuid.UUID(finding_id)))
    except Exception as exc:
        logger.exception("apply_finding_task_failed finding_id=%s", finding_id)
        raise self.retry(exc=exc)


async def _apply_finding(finding_id: uuid.UUID) -> bool:
    async with AsyncSessionAdmin() as session:
        result = await session.execute(
            select(AuditFinding).where(AuditFinding.id == finding_id)
        )
        finding = result.scalar_one_or_none()

        if finding is None or finding.state != "approved":
            return False

        accounts = (
            await session.execute(
                select(AdAccount).where(AdAccount.user_id == finding.user_id)
            )
        ).scalars().all()

    ok = await agent_runner._try_apply(
        finding={"suggested_action": finding.suggested_action},
        accounts=accounts,
    )

    async with AsyncSessionAdmin() as session:
        result = await session.execute(
            select(AuditFinding).where(AuditFinding.id == finding_id)
        )
        finding = result.scalar_one()

        if ok:
            finding.state = "applied"
            finding.kind = "applied"
            finding.applied_at = datetime.now(timezone.utc)

        await session.commit()

    return ok


# ---------------------------
# Periodic schedule
# ---------------------------

celery_app.conf.beat_schedule = {
    "agent-runner-tick": {
        "task": "agent.tick",
        "schedule": 5 * 60.0,
    },
    "ops-daily-digest": {
        "task": "ops.daily_digest",
        "schedule": 24 * 60 * 60.0,
    },
    "ops-code-audit-tick": {
        "task": "ops.code_audit_tick",
        "schedule": 60 * 60.0,
    },
}


@celery_app.task(name="agent.tick")
def agent_tick() -> int:
    return _run_async(_tick())


async def _tick() -> int:
    now = datetime.now(timezone.utc)
    dispatched = 0

    async with AsyncSessionAdmin() as session:
        result = await session.execute(
            select(Agent).where(
                Agent.status == "active",
                Agent.next_run_at.is_not(None),
                Agent.next_run_at <= now,
            )
        )
        agents = result.scalars().all()

        for agent in agents:
            run_agent_task.delay(str(agent.id))
            agent.next_run_at = now + timedelta(hours=24)
            dispatched += 1

        await session.commit()

    return dispatched


@celery_app.task(name="ops.daily_digest", bind=True, max_retries=2, default_retry_delay=60)
def daily_ops_digest_task(self) -> bool:
    try:
        return _run_async(_daily_ops_digest())
    except Exception as exc:
        logger.exception("daily_ops_digest_failed")
        raise self.retry(exc=exc)


async def _daily_ops_digest() -> bool:
    settings = get_settings()
    today = datetime.now(timezone.utc).date()
    month_prefix = today.strftime("%Y-%m")

    async with AsyncSessionAdmin() as session:
        new_feedback = (
            await session.execute(
                select(func.count()).select_from(FeedbackItem).where(FeedbackItem.status == "new")
            )
        ).scalar_one()
        failed_runs = (
            await session.execute(
                select(func.count()).select_from(ProductAgentRun).where(ProductAgentRun.status == "failed")
            )
        ).scalar_one()
        usage = (
            await session.execute(
                select(AiUsageDaily).where(func.to_char(AiUsageDaily.day, "YYYY-MM") == month_prefix)
            )
        ).scalars().all()

    month_cost = sum(row.cost_minor for row in usage)
    month_tokens = sum(row.input_tokens + row.output_tokens for row in usage)
    budget = settings.ai_monthly_budget_minor
    budget_pct = round(month_cost / budget * 100, 1) if budget else 0

    if new_feedback == 0 and failed_runs == 0 and budget_pct < settings.ai_budget_alert_threshold_pct:
        text = (
            "ДОЖИМ-АЙ: все работает штатно.\n"
            f"AI: {month_tokens:,} токенов за месяц, расход {month_cost / 100:.0f} ₽ "
            f"из {budget / 100:.0f} ₽."
        )
    else:
        text = (
            "ДОЖИМ-АЙ: нужно внимание.\n"
            f"Новые отзывы/баги: {new_feedback}\n"
            f"Ошибки агентов: {failed_runs}\n"
            f"AI-бюджет: {budget_pct}% ({month_cost / 100:.0f} ₽ из {budget / 100:.0f} ₽)."
        )

    return await telegram.send_ops_message(text)


@celery_app.task(name="ops.code_audit_tick")
def code_audit_tick_task() -> bool:
    return _run_async(_code_audit_tick())


async def _code_audit_tick() -> bool:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    next_run = now + timedelta(days=settings.code_audit_schedule_days)

    async with AsyncSessionAdmin() as session:
        existing = (
            await session.execute(
                select(ProductAgentRun).where(ProductAgentRun.kind == "code_audit")
            )
        ).scalars().first()

        if existing and existing.next_run_at and existing.next_run_at > now:
            return False

        if existing is None:
            existing = ProductAgentRun(
                name="Аудит кода",
                kind="code_audit",
                status="planned",
                schedule=f"раз в {settings.code_audit_schedule_days} дня",
            )
            session.add(existing)

        existing.status = "planned"
        existing.next_run_at = next_run
        existing.summary = (
            "Запланирован аудит кода. Подключите внутренний агент или внешний "
            "инструмент через воркер, чтобы выполнять проверку автоматически."
        )
        await session.commit()

    return True
