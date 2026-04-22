"""Billing: tier catalog + payments (create + webhook + status).

`upgrade-intent` remains as a lightweight "clicked the paywall" audit
event; the real checkout path goes through `/billing/create-payment`.

Payments flow:
  1. Client POSTs `/billing/create-payment` with a plan id.
  2. We compute the price from `PLANS`, open a user-scoped tx, call
     the provider, insert a `pending` row.
  3. Client is redirected to `confirmation_url` (provider-hosted).
  4. Provider POSTs `/billing/webhook` — admin-session handler flips
     the row to `succeeded` and bumps `users.plan` + `plan_expires_at`.
  5. Client lands on `/billing/success` and polls
     `/billing/status/{id}` until `succeeded`.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Request, status

from app.core.config import get_settings
from app.core.database import AsyncSessionAdmin, UserDB
from app.middleware.auth import CurrentUser
from app.middleware.rate_limit import limiter
from app.schemas.billing import (
    CreatePaymentRequest,
    CreatePaymentResponse,
    PaymentStatusResponse,
    PlanInfo,
    PlansResponse,
    UpgradeIntentRequest,
    UpgradeIntentResponse,
    WebhookAck,
)
from app.services import audit, payments, payments_yookassa
from app.services.billing import PLANS, get_plan

router = APIRouter(prefix="/billing", tags=["billing"])
logger = logging.getLogger("billing")
settings = get_settings()


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


# ---------------------------------------------------------------------
# Payments
# ---------------------------------------------------------------------
@router.post(
    "/create-payment",
    response_model=CreatePaymentResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("5/minute")
async def create_payment(
    request: Request,
    payload: CreatePaymentRequest,
    user: CurrentUser,
    db: UserDB,
) -> CreatePaymentResponse:
    plan = get_plan(payload.plan)
    if plan.price_rub <= 0:
        raise HTTPException(status_code=400, detail="plan_not_payable")

    amount_minor = plan.price_rub * 100  # RUB → kopecks
    description = f"SaaS Direct — тариф {plan.label}"

    try:
        result = await payments.create_payment(
            db,
            user_id=user.id,
            plan=plan.id,
            amount_minor=amount_minor,
            currency="RUB",
            return_url=settings.payment_return_url,
            description=description,
            metadata={"user_id": str(user.id), "plan": plan.id},
        )
    except Exception as exc:  # noqa: BLE001 — provider errors surfaced as 502
        logger.exception("create_payment_failed user=%s", user.id)
        await audit.log(
            action=audit.Action.PAYMENT_FAILED,
            request=request,
            user=user,
            success=False,
            meta={"plan": plan.id, "stage": "provider", "error": str(exc)[:256]},
        )
        raise HTTPException(status_code=502, detail="provider_unavailable") from exc

    confirmation_url = result["confirmation_url"]
    if not confirmation_url:
        raise HTTPException(status_code=502, detail="provider_no_url")

    await audit.log(
        action=audit.Action.PAYMENT_INITIATED,
        request=request,
        user=user,
        success=True,
        meta={
            "payment_id": str(result["id"]),
            "plan": plan.id,
            "amount_minor": amount_minor,
            "provider": result["provider"],
        },
    )

    return CreatePaymentResponse(
        payment_id=result["id"],
        confirmation_url=confirmation_url,
        status=result["status"],
    )


def _webhook_client_ip(request: Request) -> str | None:
    """Prefer the leftmost X-Forwarded-For, else the peer address.

    Production deployments terminate TLS at a reverse proxy that
    writes `X-Forwarded-For`.  The leftmost hop is the original caller
    — YooKassa in the happy path, a forger otherwise.  If you run
    behind a trusted proxy chain with multiple hops, tighten this to
    the N-th-from-right.
    """
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        first = fwd.split(",", 1)[0].strip()
        if first:
            return first
    if request.client:
        return request.client.host
    return None


@router.post(
    "/webhook",
    response_model=WebhookAck,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("120/minute")
async def payments_webhook(request: Request) -> WebhookAck:
    """Provider callback.

    Opens its own admin session — webhooks carry no JWT and we need
    to write to `users` (owned by another user).  The provider is
    YooKassa today; to support Stripe/another later, branch here on
    headers / URL prefix and call the right parser.

    Authentication is by source IP allowlist — YooKassa doesn't sign
    webhooks.  Empty config falls back to loopback only.
    """
    client_ip = _webhook_client_ip(request)
    if not payments_yookassa.is_webhook_source_allowed(client_ip):
        logger.warning("webhook_denied ip=%s", client_ip)
        # 404 rather than 403 so we don't advertise the surface.
        raise HTTPException(status_code=404, detail="not_found")

    try:
        payload = await request.json()
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="invalid_json")

    provider_name = "yookassa"

    async with AsyncSessionAdmin() as session:
        session.info["kind"] = "admin"
        try:
            result = await payments.handle_webhook(
                session, provider_name=provider_name, payload=payload
            )
            await session.commit()
        except Exception:
            await session.rollback()
            raise

    if result.get("plan_granted"):
        await audit.log(
            action=audit.Action.PAYMENT_SUCCEEDED,
            request=request,
            user=result.get("user_id"),
            success=True,
            meta={
                "payment_id": result.get("payment_id"),
                "plan": result.get("plan"),
                "provider": provider_name,
            },
        )
    elif result.get("status") == "failed":
        await audit.log(
            action=audit.Action.PAYMENT_FAILED,
            request=request,
            user=result.get("user_id"),
            success=False,
            meta={
                "payment_id": result.get("payment_id"),
                "plan": result.get("plan"),
                "provider": provider_name,
                "stage": "webhook",
            },
        )

    return WebhookAck(ok=bool(result.get("ok")))


@router.get(
    "/status/{payment_id}",
    response_model=PaymentStatusResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("60/minute")
async def payment_status(
    request: Request,
    payment_id: str,
    user: CurrentUser,
    db: UserDB,
) -> PaymentStatusResponse:
    import uuid

    try:
        pid = uuid.UUID(payment_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="bad_payment_id") from exc

    row = await payments.get_payment(db, payment_id=pid)
    if row is None or str(row["user_id"]) != str(user.id):
        # Don't leak ownership — same 404 for "wrong user" and "not found".
        raise HTTPException(status_code=404, detail="payment_not_found")

    return PaymentStatusResponse(
        id=row["id"],
        plan=row["plan"],
        amount=row["amount"],
        currency=row["currency"],
        status=row["status"],
        created_at=row["created_at"],
        paid_at=row["paid_at"],
    )
