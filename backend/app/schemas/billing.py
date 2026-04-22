from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


PlanId = Literal["free", "starter", "pro"]
PaidPlanId = Literal["starter", "pro"]
PaymentStatus = Literal["pending", "succeeded", "failed", "canceled"]


class UpgradeIntentRequest(BaseModel):
    plan: PlanId = "starter"
    # Where the click came from — used for conversion analytics.
    trigger: str = Field(default="unknown", max_length=64)
    # Arbitrary context (e.g. {"ads_left": 15}).  Size-capped by the
    # `meta` column on audit_logs.
    context: dict[str, str | int | float | bool | None] | None = None


class UpgradeIntentResponse(BaseModel):
    accepted: bool = True
    message: str = "Скоро откроем оплату. Мы пришлём письмо."


class PlanInfo(BaseModel):
    id: PlanId
    label: str
    price_rub: int
    uploads_per_month: int | None
    max_ads_per_upload: int
    ai_ads_per_period: int | None
    watermark: bool


class PlansResponse(BaseModel):
    plans: list[PlanInfo]


class CreatePaymentRequest(BaseModel):
    plan: PaidPlanId


class CreatePaymentResponse(BaseModel):
    payment_id: uuid.UUID
    confirmation_url: str
    status: PaymentStatus


class PaymentStatusResponse(BaseModel):
    id: uuid.UUID
    plan: PaidPlanId
    amount: int  # minor units
    currency: str
    status: PaymentStatus
    created_at: datetime
    paid_at: datetime | None = None


class WebhookAck(BaseModel):
    ok: bool
