"""START constructor: brief → N generated Yandex Direct ads.

Parallel to `/excel/improve-all`: the generator is metered against the
same `ai_ads` quota (each generated ad counts as one AI-ad), degrades
gracefully when the model is unavailable, and returns partial results
+ a paywall hint when the caller asks for more than remaining budget
allows.

The `/excel/export` endpoint is reused for downloading the Yandex
Direct-shaped XLSX — the frontend just posts the generated ads there.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Request, status

from app.middleware.auth import CurrentUser
from app.middleware.rate_limit import limiter
from app.core.database import UserDB
from app.schemas.start import (
    StartBrief,
    StartGeneratedAd,
    StartGenerateResponse,
)
from app.services import ai_start, audit, billing
from app.services.excel_pipeline import (
    _maybe_paywall_to_schema,
    _snapshot_to_limits,
    _snapshot_to_usage,
)

router = APIRouter(prefix="/start", tags=["start"])
logger = logging.getLogger("start")


@router.post(
    "/generate",
    response_model=StartGenerateResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("5/minute")
async def generate_start_ads(
    request: Request,
    payload: StartBrief,
    user: CurrentUser,
    db: UserDB,
) -> StartGenerateResponse:
    plan_id = getattr(user, "plan", "free") or "free"
    lifetime = int(getattr(user, "ai_ads_used_lifetime", 0) or 0)
    usage = await billing.get_usage(db, user.id, plan_id, lifetime)

    requested = payload.count
    allowed, capped = billing.cap_ai_budget(requested, usage)

    ads: list[StartGeneratedAd] = []
    if allowed > 0:
        brief = payload.model_dump()
        brief["count"] = allowed
        raw = await ai_start.generate_ads(brief)
        for item in raw[:allowed]:
            ads.append(StartGeneratedAd(**item))

    generated = len(ads)

    if generated > 0:
        await billing.consume_usage(
            db,
            user.id,
            ai_ads=generated,
            ai_requests=1,
            plan_id=plan_id,
        )

    usage_after = await billing.get_usage(
        db, user.id, plan_id, lifetime + generated
    )

    pw_trigger: billing.PaywallTrigger | None = None
    unimproved_left = max(0, requested - generated)
    if capped:
        pw_trigger = "on_improve_all"
    elif (
        usage_after.ai_ads_remaining == 0
        and usage.plan != "pro"
        and generated > 0
    ):
        pw_trigger = "after_analysis"

    paywall = (
        billing.build_paywall(
            pw_trigger, plan=usage.plan, unimproved_left=unimproved_left
        )
        if pw_trigger
        else None
    )

    await audit.log(
        action=audit.Action.START_GENERATE,
        request=request,
        user=user,
        meta={
            "requested": requested,
            "generated": generated,
            "plan": plan_id,
        },
    )

    return StartGenerateResponse(
        ads=ads,
        requested_count=requested,
        generated_count=generated,
        plan=plan_id,
        limits=_snapshot_to_limits(plan_id),
        usage=_snapshot_to_usage(usage_after),
        paywall=_maybe_paywall_to_schema(paywall),
    )
