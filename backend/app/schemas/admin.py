from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


class FunnelMetricsResponse(BaseModel):
    signups: int
    connectors: int
    activators: int
    payers: int
    revenue_minor: int  # kopecks
    connect_rate: float
    activate_rate: float
    pay_rate: float


class AdminUserItem(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str | None
    plan: str
    is_active: bool
    plan_expires_at: datetime | None
    created_at: datetime


class AdminUsersResponse(BaseModel):
    total: int
    items: list[AdminUserItem]


class AdminPaymentItem(BaseModel):
    id: uuid.UUID
    user_email: str
    plan: str
    amount: int
    currency: str
    status: str
    provider: str
    created_at: datetime
    paid_at: datetime | None


class AdminPaymentsResponse(BaseModel):
    total: int
    items: list[AdminPaymentItem]


class CrmLeadOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None = None
    name: str | None = None
    email: str | None = None
    plan: str
    source: str
    status: str
    score: int
    next_action_at: datetime | None = None
    meta: dict[str, Any]


class CrmSegmentOut(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    color: str
    sort_order: int
    trigger_event: str
    trigger_delay_minutes: int
    auto_enabled: bool
    template: str
    channels: dict[str, Any]
    lead_count: int
    leads: list[CrmLeadOut] = []


class CrmOverviewResponse(BaseModel):
    segments: list[CrmSegmentOut]


class CrmTemplateUpdate(BaseModel):
    template: str
    auto_enabled: bool | None = None
    channels: dict[str, Any] | None = None


class BroadcastResult(BaseModel):
    segment_slug: str
    queued: int
    channels: dict[str, Any]


class FeedbackCreate(BaseModel):
    kind: str
    title: str
    body: str
    rating: int | None = None
    source: str = "in_app"
    meta: dict[str, Any] = Field(default_factory=dict)


class FeedbackStatusUpdate(BaseModel):
    status: str


class FeedbackOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None = None
    kind: str
    rating: int | None = None
    status: str
    title: str
    body: str
    source: str
    meta: dict[str, Any]
    created_at: datetime


class ProductAgentRunOut(BaseModel):
    id: uuid.UUID
    name: str
    kind: str
    status: str
    schedule: str
    started_at: datetime | None = None
    finished_at: datetime | None = None
    next_run_at: datetime | None = None
    input_tokens: int
    output_tokens: int
    cost_minor: int
    summary: str | None = None
    error: str | None = None


class AiUsageDayOut(BaseModel):
    day: date
    provider: str
    model: str
    input_tokens: int
    output_tokens: int
    cost_minor: int
    budget_minor: int


class AgentOpsResponse(BaseModel):
    runs: list[ProductAgentRunOut]
    usage: list[AiUsageDayOut]
    month_cost_minor: int
    month_tokens: int
    budget_minor: int
    budget_used_pct: float
    telegram_enabled: bool
    code_audit_schedule_days: int


class PayrollEntryOut(BaseModel):
    id: uuid.UUID
    period: str
    employee_name: str
    employee_email: str | None = None
    role: str
    hours: int
    variable_minor: int
    kpi_bonus_minor: int
    total_minor: int
    status: str


class PayrollResponse(BaseModel):
    period: str
    total_minor: int
    entries: list[PayrollEntryOut]
