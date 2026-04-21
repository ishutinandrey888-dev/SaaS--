"""Billing stubs + tier catalog.

This is intentionally a thin layer: no ЮKassa / Stripe yet, but the
surface is stable enough that wiring a real provider later is a
drop-in.  The **only** side effect here is writing an audit row so we
can measure paywall CTR.
"""

from __future__ import annotations

from fastapi import APIRouter, Request, status

from app.middleware.auth import CurrentUser
from app.middleware.rate_limit import limiter
from app.schemas.billing import (
    PlanInfo,
    PlansResponse,
    UpgradeIntentRequest,
    UpgradeIntentResponse,
)
from app.services import audit
from app.services.billing import PLANS

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/plans", response_model=PlansResponse)
async def list_plans() -> PlansResponse:
    """Public tier catalog.  Unauthenticated so /pricing can render."""
    return PlansResponse(
        plans=[
            PlanInfo(
                id=plan.id,
                label=plan.label,
                price_rub=plan.price_rub,
                uploads_per_month=plan.uploads_per_month,
                max_ads_per_upload=plan.max_ads_per_upload,
                ai_ads_per_period=plan.ai_ads_per_period,
                watermark=plan.watermark,
            )
            for plan in PLANS.values()
        ]
    )


@router.post(
    "/upgrade-intent",
    response_model=UpgradeIntentResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
@limiter.limit("30/minute")
async def upgrade_intent(
    request: Request,
    payload: UpgradeIntentRequest,
    user: CurrentUser,
) -> UpgradeIntentResponse:
    """Log a paywall click.

    Once ЮKassa/Stripe is wired this endpoint issues a checkout URL;
    for now it's a stub that records intent for conversion analytics.
    """
    meta: dict = {
        "target_plan": payload.plan,
        "trigger": payload.trigger,
        "current_plan": getattr(user, "plan", "free"),
    }
    if payload.context:
        # Truncate to keep the JSONB row compact.
        meta["context"] = dict(list(payload.context.items())[:8])

    await audit.log(
        action=audit.Action.PAYMENTS_SUBSCRIBE,
        request=request,
        user=user,
        success=True,
        meta=meta,
    )
    return UpgradeIntentResponse()
