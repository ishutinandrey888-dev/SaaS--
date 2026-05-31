from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


PlanId = Literal["free", "pro", "agency"]
PaidPlanId = Literal["pro", "agency"]
PaymentStatus = Literal["pending", "succeeded", "failed", "canceled"]


class Limits(BaseModel):
    plan: str
    uploads: int | None
    ai_ads: int | None
    max_ads_per_upload: int
    watermark: bool = False


class Usage(BaseModel):
    uploads_used: int
    ai_ads_used: int
    ai_ads_remaining: int | None


class Paywall(BaseModel):
    trigger: str
    message: str
    cta: str
    upgrade_hint: str | None = None


class UpgradeIntentRequest(BaseModel):
    plan: PlanId = "pro"
    trigger: str = Field(default="unknown", max_length=64)
    context: dict[str, str | int | float | bool | None] | None = None


class UpgradeIntentResponse(BaseModel):
    accepted: bool = True
    message: str = "Скоро откроем оплату. Мы пришлём письмо."


class PlanInfo(BaseModel):
    id: PlanId
    label: str
    price_rub: int
    token_limit: int
    gross_margin: str
    estimated_cogs_rub: int
    uploads_per_month: int | None
    max_ads_per_upload: int
    ai_ads_per_period: int | None
    watermark: bool


class PlansResponse(BaseModel):
    plans: list[PlanInfo]


class TokenBalanceResponse(BaseModel):
    plan: PlanId
    period: str
    token_limit: int
    tokens_used: int
    bonus_tokens: int
    tokens_remaining: int
    usage_percent: int
    warn_at_percent: int = 80
    limit_reached: bool
    period_ends_at: datetime | None = None


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
