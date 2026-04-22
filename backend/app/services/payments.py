"""Payments flow: create → provider → webhook → plan flip.

Design:
  * `create_payment` inserts a `pending` row, calls the provider,
    stores `provider_payment_id` + `confirmation_url`, returns the
    Payment model.
  * `handle_webhook` looks the row up by `(provider, provider_payment_id)`,
    maps the provider status onto our enum, and, on success, bumps
    `users.plan` + `users.plan_expires_at`.  Idempotent: a replayed
    webhook for a row already in `succeeded` is a no-op.

Plan expiry: `PLAN_PERIOD_DAYS = 31` gives the user at least a
calendar month regardless of month length.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services import payments_yookassa as provider

logger = logging.getLogger("payments")

PLAN_PERIOD_DAYS = 31

# Map provider states to our internal enum.
_YOOKASSA_STATUS = {
    "succeeded": "succeeded",
    "canceled": "canceled",
    "pending": "pending",
    "waiting_for_capture": "pending",
}


def _map_provider_status(provider_name: str, status: str) -> str:
    if provider_name == "stub":
        return "succeeded" if status in ("succeeded", "pending") else "failed"
    return _YOOKASSA_STATUS.get(status, "pending")


# ---------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------
_INSERT_PAYMENT = text(
    """
    INSERT INTO payments (
        id, user_id, plan, amount, currency,
        provider, provider_payment_id, status, confirmation_url
    ) VALUES (
        :id, :user_id, :plan, :amount, :currency,
        :provider, :provider_payment_id, :status, :confirmation_url
    )
    """
)


async def create_payment(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    plan: str,
    amount_minor: int,
    currency: str,
    return_url: str,
    description: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Create the DB row, call the provider, persist provider ids."""
    payment_id = uuid.uuid4()
    idempotency_key = str(payment_id)

    # Thread the payment id into the return URL so the /billing/success
    # page always lands with an ?id=... it can poll.  This works for
    # the stub provider *and* the real one: YooKassa just opens the URL
    # as-is after checkout.
    sep = "&" if "?" in return_url else "?"
    provider_return_url = f"{return_url}{sep}id={payment_id}"

    # Call the provider first — if it fails we surface the error and
    # *don't* litter the DB with a pending row we'll never reconcile.
    pp = await provider.create_payment(
        amount_minor=amount_minor,
        currency=currency,
        description=description,
        return_url=provider_return_url,
        idempotency_key=idempotency_key,
        metadata={**(metadata or {}), "internal_id": str(payment_id)},
    )

    initial_status = _map_provider_status(pp.provider, pp.status)

    await session.execute(
        _INSERT_PAYMENT,
        {
            "id": str(payment_id),
            "user_id": str(user_id),
            "plan": plan,
            "amount": amount_minor,
            "currency": currency,
            "provider": pp.provider,
            "provider_payment_id": pp.id,
            "status": initial_status,
            "confirmation_url": pp.confirmation_url,
        },
    )

    return {
        "id": payment_id,
        "provider": pp.provider,
        "provider_payment_id": pp.id,
        "status": initial_status,
        "confirmation_url": pp.confirmation_url,
    }


# ---------------------------------------------------------------------
# Webhook
# ---------------------------------------------------------------------
_SELECT_FOR_UPDATE = text(
    """
    SELECT id, user_id, plan, status
    FROM payments
    WHERE provider = :provider AND provider_payment_id = :provider_payment_id
    FOR UPDATE
    """
)

_UPDATE_STATUS = text(
    """
    UPDATE payments
    SET status = :status,
        paid_at = CASE WHEN :status = 'succeeded' THEN NOW() ELSE paid_at END
    WHERE id = :id
    """
)

_UPDATE_USER_PLAN = text(
    """
    UPDATE users
    SET plan = :plan,
        plan_expires_at = :expires_at
    WHERE id = :user_id
    """
)


async def handle_webhook(
    session: AsyncSession,
    *,
    provider_name: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Parse payload, flip the row, grant the plan.

    Returns a small audit-friendly dict.  Always returns even for
    already-processed payments (idempotent no-op).
    """
    parsed = provider.parse_webhook(payload)
    if parsed is None:
        return {"ok": False, "reason": "unparseable"}

    provider_payment_id, provider_status = parsed
    new_status = _map_provider_status(provider_name, provider_status)

    row = await session.execute(
        _SELECT_FOR_UPDATE,
        {
            "provider": provider_name,
            "provider_payment_id": provider_payment_id,
        },
    )
    hit = row.mappings().first()
    if hit is None:
        return {"ok": False, "reason": "unknown_payment"}

    # Idempotency: don't downgrade a terminal state.
    if hit["status"] in ("succeeded", "failed", "canceled"):
        return {"ok": True, "reason": "already_terminal", "status": hit["status"]}

    if new_status == hit["status"]:
        return {"ok": True, "reason": "no_change"}

    await session.execute(
        _UPDATE_STATUS,
        {"id": str(hit["id"]), "status": new_status},
    )

    granted = False
    if new_status == "succeeded":
        expires_at = datetime.now(timezone.utc) + timedelta(days=PLAN_PERIOD_DAYS)
        await session.execute(
            _UPDATE_USER_PLAN,
            {
                "user_id": str(hit["user_id"]),
                "plan": hit["plan"],
                "expires_at": expires_at,
            },
        )
        granted = True

    return {
        "ok": True,
        "payment_id": str(hit["id"]),
        "user_id": str(hit["user_id"]),
        "plan": hit["plan"],
        "status": new_status,
        "plan_granted": granted,
    }


# ---------------------------------------------------------------------
# Read (status poll)
# ---------------------------------------------------------------------
_SELECT_BY_ID = text(
    """
    SELECT id, user_id, plan, amount, currency, status,
           provider, provider_payment_id, created_at, paid_at
    FROM payments
    WHERE id = :id
    """
)


async def get_payment(
    session: AsyncSession, *, payment_id: uuid.UUID
) -> dict[str, Any] | None:
    res = await session.execute(_SELECT_BY_ID, {"id": str(payment_id)})
    row = res.mappings().first()
    return dict(row) if row else None
