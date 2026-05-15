from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel


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
