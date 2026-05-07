"""Dashboard surface for the agent product.

Single GET endpoint that hydrates the home page in one round-trip:
plan + current quota + agent counters + recent run window.

Visibility is capped by `plan.history_days` (free=7, pro=30, agency=∞).
RLS filters per-user; the cutoff is applied in SQL so paid tiers don't
ship larger payloads than they need.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter
from sqlalchemy import text

from app.core.database import UserDB
from app.middleware.auth import CurrentUser
from app.schemas.billing import Limits, Usage
from app.schemas.dashboard import (
    DashboardResponse,
    HistoryEntry,
    HistoryTotals,
)
from app.services import billing

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
logger = logging.getLogger("dashboard")

_HISTORY_LIMIT = 50

_HISTORY_SQL_WINDOW = text(
    """
    SELECT r.id, r.agent_id, a.name AS agent_name, r.status,
           r.stats, r.started_at, r.finished_at
    FROM ai_runs r
    JOIN agents a ON a.id = r.agent_id
    WHERE r.started_at >= NOW() - (:days || ' days')::interval
    ORDER BY r.started_at DESC
    LIMIT :limit
    """
)

_HISTORY_SQL_ALL = text(
    """
    SELECT r.id, r.agent_id, a.name AS agent_name, r.status,
           r.stats, r.started_at, r.finished_at
    FROM ai_runs r
    JOIN agents a ON a.id = r.agent_id
    ORDER BY r.started_at DESC
    LIMIT :limit
    """
)

_TOTALS_SQL_WINDOW = text(
    """
    SELECT
        (SELECT COUNT(*) FROM agents WHERE status = 'active')        AS active_agents,
        (SELECT COUNT(*) FROM ai_runs
            WHERE started_at >= NOW() - (:days || ' days')::interval) AS runs,
        (SELECT COUNT(*) FROM audit_findings f
            JOIN ai_runs r ON r.id = f.run_id
            WHERE r.started_at >= NOW() - (:days || ' days')::interval
            AND f.state = 'applied')                                  AS applied,
        (SELECT COUNT(*) FROM audit_findings f
            JOIN ai_runs r ON r.id = f.run_id
            WHERE r.started_at >= NOW() - (:days || ' days')::interval
            AND f.state = 'new')                                      AS pending
    """
)

_TOTALS_SQL_ALL = text(
    """
    SELECT
        (SELECT COUNT(*) FROM agents WHERE status = 'active')   AS active_agents,
        (SELECT COUNT(*) FROM ai_runs)                          AS runs,
        (SELECT COUNT(*) FROM audit_findings WHERE state='applied') AS applied,
        (SELECT COUNT(*) FROM audit_findings WHERE state='new')     AS pending
    """
)


def _limits(plan_id: str) -> Limits:
    p = billing.get_plan(plan_id)
    return Limits(
        plan=p.id,
        uploads=p.uploads_per_month,
        ai_ads=p.ai_ads_per_period,
        max_ads_per_upload=p.max_ads_per_upload,
        watermark=p.watermark,
    )


def _usage(snap: billing.UsageSnapshot) -> Usage:
    return Usage(
        uploads_used=snap.uploads_used,
        ai_ads_used=snap.ai_ads_used,
        ai_ads_remaining=snap.ai_ads_remaining,
    )


@router.get("", response_model=DashboardResponse)
async def get_dashboard(user: CurrentUser, db: UserDB) -> DashboardResponse:
    plan_id = billing.get_effective_plan(user)
    plan = billing.get_plan(plan_id)
    lifetime = int(getattr(user, "ai_ads_used_lifetime", 0) or 0)

    snap = await billing.get_usage(db, user.id, plan_id, lifetime)

    if plan.history_days is None:
        rows_result = await db.execute(_HISTORY_SQL_ALL, {"limit": _HISTORY_LIMIT})
        totals_result = await db.execute(_TOTALS_SQL_ALL)
    else:
        rows_result = await db.execute(
            _HISTORY_SQL_WINDOW,
            {"days": plan.history_days, "limit": _HISTORY_LIMIT},
        )
        totals_result = await db.execute(
            _TOTALS_SQL_WINDOW, {"days": plan.history_days}
        )

    history: list[HistoryEntry] = []
    for r in rows_result.mappings().all():
        stats = r["stats"] or {}
        history.append(
            HistoryEntry(
                id=str(r["id"]),
                agent_id=str(r["agent_id"]),
                agent_name=r["agent_name"],
                status=r["status"],
                findings=int(stats.get("findings", 0) or 0),
                applied=int(stats.get("applied", 0) or 0),
                started_at=r["started_at"],
                finished_at=r["finished_at"],
            )
        )

    t = totals_result.mappings().first() or {}
    totals = HistoryTotals(
        active_agents=int(t.get("active_agents", 0) or 0),
        runs=int(t.get("runs", 0) or 0),
        applied=int(t.get("applied", 0) or 0),
        pending=int(t.get("pending", 0) or 0),
    )

    return DashboardResponse(
        plan=plan_id,
        limits=_limits(plan_id),
        usage=_usage(snap),
        totals=totals,
        history=history,
        history_days=plan.history_days,
    )
