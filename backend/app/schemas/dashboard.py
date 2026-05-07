from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.schemas.billing import Limits, Usage


class HistoryEntry(BaseModel):
    id: str
    agent_id: str
    agent_name: str
    status: str
    findings: int
    applied: int
    started_at: datetime
    finished_at: datetime | None = None


class HistoryTotals(BaseModel):
    """Aggregates over the visible window (capped by plan.history_days)."""

    active_agents: int
    runs: int
    applied: int
    pending: int


class DashboardResponse(BaseModel):
    plan: str
    limits: Limits
    usage: Usage
    totals: HistoryTotals
    history: list[HistoryEntry]
    history_days: int | None  # None = unlimited
