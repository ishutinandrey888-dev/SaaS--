"""Dashboard / retention surface.

Single GET endpoint that hydrates the /dashboard page in one round-trip:
plan + current quota + recent uploads + window aggregates.

Visibility is capped by `plan.history_days` (free=7, starter=30, pro=∞).
RLS already filters `upload_history` to the owner; the cutoff is
applied in SQL so paid tiers don't ship larger payloads than they need.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter
from sqlalchemy import text

from app.core.database import UserDB
from app.middleware.auth import CurrentUser
from app.schemas.dashboard import (
    DashboardResponse,
    HistoryEntry,
    HistoryTotals,
)
from app.schemas.excel import Limits, Usage
from app.services import billing

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
logger = logging.getLogger("dashboard")

_HISTORY_LIMIT = 50  # newest N rows the UI lists; older rows still hit totals.

_HISTORY_SQL_WINDOW = text(
    """
    SELECT id, filename, total_ads, total_campaigns,
           improved_count, weak_ads_percent, avg_score, created_at
    FROM upload_history
    WHERE created_at >= NOW() - (:days || ' days')::interval
    ORDER BY created_at DESC
    LIMIT :limit
    """
)

_HISTORY_SQL_ALL = text(
    """
    SELECT id, filename, total_ads, total_campaigns,
           improved_count, weak_ads_percent, avg_score, created_at
    FROM upload_history
    ORDER BY created_at DESC
    LIMIT :limit
    """
)

_TOTALS_SQL_WINDOW = text(
    """
    SELECT COUNT(*)              AS uploads,
           COALESCE(SUM(total_ads), 0)      AS ads,
           COALESCE(SUM(improved_count), 0) AS improved,
           COALESCE(AVG(avg_score), 0)      AS avg_score
    FROM upload_history
    WHERE created_at >= NOW() - (:days || ' days')::interval
    """
)

_TOTALS_SQL_ALL = text(
    """
    SELECT COUNT(*)              AS uploads,
           COALESCE(SUM(total_ads), 0)      AS ads,
           COALESCE(SUM(improved_count), 0) AS improved,
           COALESCE(AVG(avg_score), 0)      AS avg_score
    FROM upload_history
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
        rows_result = await db.execute(
            _HISTORY_SQL_ALL, {"limit": _HISTORY_LIMIT}
        )
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
        history.append(
            HistoryEntry(
                id=str(r["id"]),
                filename=r["filename"],
                total_ads=int(r["total_ads"]),
                total_campaigns=int(r["total_campaigns"]),
                improved_count=int(r["improved_count"]),
                weak_ads_percent=int(r["weak_ads_percent"]),
                avg_score=float(r["avg_score"]),
                created_at=r["created_at"],
            )
        )

    t = totals_result.mappings().first() or {}
    totals = HistoryTotals(
        uploads=int(t.get("uploads", 0) or 0),
        ads=int(t.get("ads", 0) or 0),
        improved=int(t.get("improved", 0) or 0),
        avg_score=round(float(t.get("avg_score", 0) or 0), 1),
    )

    return DashboardResponse(
        plan=plan_id,
        limits=_limits(plan_id),
        usage=_usage(snap),
        totals=totals,
        history=history,
        history_days=plan.history_days,
    )
