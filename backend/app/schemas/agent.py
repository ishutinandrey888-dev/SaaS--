from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


AgentMode = Literal["advisor", "assistant", "auto"]
AgentStatus = Literal["draft", "active", "paused", "archived"]


class AgentBrief(BaseModel):
    """Free-form brief — keep loose so the wizard can evolve."""

    url: str | None = None
    niche: str | None = None
    audience: str | None = None
    geo: str | None = None
    notes: str | None = None


class AgentKpi(BaseModel):
    cpa: float | None = None
    ctr: float | None = None
    romi: float | None = None
    budget: int | None = None  # daily, in minor currency units (kopecks)
    goal: str | None = None  # e.g. "leads", "calls", "purchases"


class AgentCreate(BaseModel):
    project_id: uuid.UUID
    name: str = Field(min_length=1, max_length=255)
    mode: AgentMode = "advisor"
    brief: AgentBrief = Field(default_factory=AgentBrief)
    kpi: AgentKpi = Field(default_factory=AgentKpi)
    ad_account_ids: list[uuid.UUID] = Field(default_factory=list)


class AgentPatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    mode: AgentMode | None = None
    brief: AgentBrief | None = None
    kpi: AgentKpi | None = None
    ad_account_ids: list[uuid.UUID] | None = None


class AgentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    mode: AgentMode
    status: AgentStatus
    brief: dict[str, Any]
    kpi: dict[str, Any]
    ad_account_ids: list[Any]
    last_run_at: datetime | None
    next_run_at: datetime | None
    created_at: datetime


class AgentListResponse(BaseModel):
    agents: list[AgentOut]


class FindingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    run_id: uuid.UUID
    agent_id: uuid.UUID
    kind: str
    severity: str
    campaign_external_id: str | None
    ad_external_id: str | None
    title: str
    effect: str | None
    suggested_action: dict[str, Any] | None
    confidence: int
    state: str
    applied_at: datetime | None
    created_at: datetime


class FindingListResponse(BaseModel):
    findings: list[FindingOut]


class RunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    agent_id: uuid.UUID
    status: str
    started_at: datetime
    finished_at: datetime | None
    stats: dict[str, Any]
    error: str | None


class RunListResponse(BaseModel):
    runs: list[RunOut]
