from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.schemas.excel import Limits, Usage


class HistoryEntry(BaseModel):
    id: str
    filename: str
    total_ads: int
    total_campaigns: int
    improved_count: int
    weak_ads_percent: int
    avg_score: float
    created_at: datetime


class HistoryTotals(BaseModel):
    """Aggregates over the visible window (capped by plan.history_days)."""

    uploads: int
    ads: int
    improved: int
    avg_score: float


class DashboardResponse(BaseModel):
    plan: str
    limits: Limits
    usage: Usage
    totals: HistoryTotals
    history: list[HistoryEntry]
    history_days: int | None  # None = unlimited
