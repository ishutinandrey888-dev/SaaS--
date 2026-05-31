"""Tier limits, quota checks, and usage accounting.

Design goals:
  * **Partial execution**, not hard failure.  When an operation exceeds
    a limit we let the caller decide: improve as many ads as remaining
    allows, return the rest un-improved, attach a paywall hint.  This
    is a deliberate conversion-funnel choice — see product spec.
  * One place for tier constants.  Touch `PLANS` and nowhere else.
  * Idempotent-ish accounting.  `consume_*` uses
    INSERT … ON CONFLICT DO UPDATE so repeated calls just increment.

Scopes of a "limit":
  * `uploads_per_month` — legacy field reused as a per-period cap on
    "process X items" operations (kept for compatibility with usage
    counters).
  * `max_ads_per_upload` — silent cap; bigger files are trimmed with a
    notice so we never process runaway spreadsheets.
  * `ai_ads` — the expensive quota.  Free: 3 **lifetime**.  Paid: per
    month.  Hybrid because free-reset-monthly trivialises the paywall.

`LimitExceeded` carries a paywall trigger string instead of just a
message so the frontend can route to the right upsell surface without
parsing copy.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("billing")

PlanId = Literal["free", "pro", "agency"]
PaywallTrigger = Literal[
    "after_analysis",
    "on_improve_all",
    "on_upload_exhausted",
    "on_ads_per_upload",
    "on_export_over_limit",
]


@dataclass(frozen=True)
class PlanDef:
    id: PlanId
    label: str
    price_rub: int  # 0 for free; display-only
    token_limit: int
    gross_margin: str
    estimated_cogs_rub: int
    uploads_per_month: int | None  # None = unlimited
    max_ads_per_upload: int
    ai_ads_per_period: int | None  # None = unlimited
    ai_reset: Literal["lifetime", "monthly"]
    watermark: bool
    history_days: int | None  # None = unlimited


# ---------------------------------------------------------------------
# Tier table — single source of truth
# ---------------------------------------------------------------------
PLANS: dict[PlanId, PlanDef] = {
    "free": PlanDef(
        id="free",
        label="Free (trial 7 дней)",
        price_rub=0,
        token_limit=500,
        gross_margin="activation",
        estimated_cogs_rub=90,
        uploads_per_month=3,
        max_ads_per_upload=50,
        ai_ads_per_period=3,
        ai_reset="lifetime",
        watermark=True,
        history_days=7,
    ),
    "pro": PlanDef(
        id="pro",
        label="Pro",
        price_rub=5990,
        token_limit=5000,
        gross_margin="84-86%",
        estimated_cogs_rub=850,
        uploads_per_month=20,
        max_ads_per_upload=500,
        ai_ads_per_period=50,
        ai_reset="monthly",
        watermark=False,
        history_days=30,
    ),
    "agency": PlanDef(
        id="agency",
        label="Agency",
        price_rub=19900,
        token_limit=15000,
        gross_margin="82-85%",
        estimated_cogs_rub=3200,
        uploads_per_month=None,
        max_ads_per_upload=2000,
        ai_ads_per_period=None,
        ai_reset="monthly",
        watermark=False,
        history_days=None,
    ),
}


def get_plan(plan_id: str | None) -> PlanDef:
    """Resolve plan id → PlanDef.  Unknown → free (fail-closed)."""
    if plan_id and plan_id in PLANS:
        return PLANS[plan_id]  # type: ignore[index]
    return PLANS["free"]


def get_effective_plan(user: object, now: datetime | None = None) -> str:
    """Return the plan id the user currently pays for — "free" if expired.

    `users.plan` is bumped to `pro`/`agency` the moment the payment
    webhook lands, and `users.plan_expires_at` is set 31 days out.  We
    don't auto-write back to `users.plan` when the window closes —
    a read-time check is enough for all gating paths and keeps the
    write-side simple.  A daily cron can clear the row later if needed.
    """
    plan = getattr(user, "plan", "free") or "free"
    if plan == "free":
        return "free"
    expires = getattr(user, "plan_expires_at", None)
    if expires is None:
        # No expiry set — treat as indefinite (admin grants, legacy rows).
        return plan
    moment = now or datetime.now(timezone.utc)
    # `expires` is TIMESTAMPTZ → timezone-aware; compare directly.
    if expires <= moment:
        return "free"
    return plan


def current_period(now: datetime | None = None) -> str:
    now = now or datetime.now(timezone.utc)
    return f"{now.year:04d}-{now.month:02d}"


# ---------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------
class LimitExceeded(Exception):
    """Raised when a hard gate cannot be satisfied at all.

    Most flows *should not* raise this — prefer partial execution via
    `cap_ai_budget` + attaching a paywall to the response.  Reserve
    this for cases where there is literally nothing we can deliver
    (e.g. monthly upload quota hit).
    """

    def __init__(
        self,
        *,
        trigger: PaywallTrigger,
        remaining: int,
        message: str = "",
    ) -> None:
        super().__init__(message or trigger)
        self.trigger: PaywallTrigger = trigger
        self.remaining = remaining


# ---------------------------------------------------------------------
# Usage snapshot
# ---------------------------------------------------------------------
@dataclass
class UsageSnapshot:
    """What the UI needs to render quota bars + paywall CTAs."""

    plan: PlanId
    uploads_used: int
    uploads_limit: int | None
    ai_ads_used: int
    ai_ads_limit: int | None
    ai_ads_remaining: int | None  # None = unlimited

    @property
    def uploads_exhausted(self) -> bool:
        return (
            self.uploads_limit is not None
            and self.uploads_used >= self.uploads_limit
        )


# ---------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------
_READ_COUNTER = text(
    """
    SELECT uploads_used, ai_ads_used, ai_requests_used
    FROM usage_counters
    WHERE user_id = :uid AND period = :period
    """
)


async def _read_counter(
    session: AsyncSession, user_id: uuid.UUID, period: str
) -> tuple[int, int, int]:
    row = (
        await session.execute(
            _READ_COUNTER, {"uid": str(user_id), "period": period}
        )
    ).first()
    if row is None:
        return (0, 0, 0)
    return (int(row[0]), int(row[1]), int(row[2]))


async def get_usage(
    session: AsyncSession,
    user_id: uuid.UUID,
    plan_id: str,
    lifetime_ai_ads: int,
    *,
    now: datetime | None = None,
) -> UsageSnapshot:
    """Read current-period usage and compute remaining AI budget."""
    plan = get_plan(plan_id)
    uploads_used, ai_ads_used_month, _ = await _read_counter(
        session, user_id, current_period(now)
    )

    if plan.ai_reset == "lifetime":
        used = lifetime_ai_ads
    else:
        used = ai_ads_used_month

    if plan.ai_ads_per_period is None:
        remaining: int | None = None
    else:
        remaining = max(0, plan.ai_ads_per_period - used)

    return UsageSnapshot(
        plan=plan.id,
        uploads_used=uploads_used,
        uploads_limit=plan.uploads_per_month,
        ai_ads_used=used,
        ai_ads_limit=plan.ai_ads_per_period,
        ai_ads_remaining=remaining,
    )


# ---------------------------------------------------------------------
# Writes — upsert counters
# ---------------------------------------------------------------------
_UPSERT_COUNTER = text(
    """
    INSERT INTO usage_counters
        (user_id, period, uploads_used, ai_ads_used, ai_requests_used)
    VALUES (:uid, :period, :up, :ai_ads, :ai_req)
    ON CONFLICT (user_id, period) DO UPDATE SET
        uploads_used     = usage_counters.uploads_used     + EXCLUDED.uploads_used,
        ai_ads_used      = usage_counters.ai_ads_used      + EXCLUDED.ai_ads_used,
        ai_requests_used = usage_counters.ai_requests_used + EXCLUDED.ai_requests_used,
        updated_at       = NOW()
    """
)

_BUMP_LIFETIME = text(
    """
    UPDATE users
    SET ai_ads_used_lifetime = ai_ads_used_lifetime + :delta
    WHERE id = :uid
    """
)


async def consume_usage(
    session: AsyncSession,
    user_id: uuid.UUID,
    *,
    uploads: int = 0,
    ai_ads: int = 0,
    ai_requests: int = 0,
    plan_id: str = "free",
    now: datetime | None = None,
) -> None:
    """Increment monthly meters, and the lifetime AI meter for free users."""
    period = current_period(now)
    await session.execute(
        _UPSERT_COUNTER,
        {
            "uid": str(user_id),
            "period": period,
            "up": uploads,
            "ai_ads": ai_ads,
            "ai_req": ai_requests,
        },
    )
    # Free users also spend lifetime AI credits.  Paid users accrue in
    # the monthly counter only (above).
    plan = get_plan(plan_id)
    if ai_ads > 0 and plan.ai_reset == "lifetime":
        await session.execute(
            _BUMP_LIFETIME, {"uid": str(user_id), "delta": ai_ads}
        )


# ---------------------------------------------------------------------
# Intake gate
# ---------------------------------------------------------------------
def check_upload_allowed(usage: UsageSnapshot) -> None:
    """Raise LimitExceeded when the user cannot start another upload."""
    if usage.uploads_exhausted:
        raise LimitExceeded(
            trigger="on_upload_exhausted",
            remaining=0,
            message="monthly upload quota exhausted",
        )


def cap_ads_per_upload(ads_count: int, plan_id: str) -> tuple[int, bool]:
    """Return (allowed_count, was_trimmed).  Silent, not raising — we
    want to process the part we can and show a paywall for the rest."""
    plan = get_plan(plan_id)
    if ads_count <= plan.max_ads_per_upload:
        return ads_count, False
    return plan.max_ads_per_upload, True


def cap_ai_budget(
    desired: int, usage: UsageSnapshot
) -> tuple[int, bool]:
    """Return (allowed, was_capped).  Never negative."""
    if usage.ai_ads_remaining is None:
        return desired, False
    allowed = max(0, min(desired, usage.ai_ads_remaining))
    return allowed, allowed < desired


# ---------------------------------------------------------------------
# Paywall building blocks
# ---------------------------------------------------------------------
@dataclass
class Paywall:
    trigger: PaywallTrigger
    message: str
    cta: str
    upgrade_hint: str | None = None


_NEXT_PLAN_CTA: dict[PlanId, str] = {
    "free": "Оформить Pro",
    "pro": "Оформить Agency",
    "agency": "",  # no upsell beyond agency
}


def _humanise_ads(n: int) -> str:
    """Русская морфология для 'ещё N объявлений'."""
    n_abs = abs(n) % 100
    tail = n_abs % 10
    if 11 <= n_abs <= 14:
        return f"{n} объявлений"
    if tail == 1:
        return f"{n} объявление"
    if 2 <= tail <= 4:
        return f"{n} объявления"
    return f"{n} объявлений"


def build_paywall(
    trigger: PaywallTrigger,
    *,
    plan: PlanId,
    unimproved_left: int = 0,
) -> Paywall | None:
    """Pick copy + CTA based on trigger and current tier."""
    if plan == "agency":
        # Agency has no hard quota on AI; no meaningful upsell in MVP.
        return None

    cta = _NEXT_PLAN_CTA.get(plan, "Оформить Pro") or "Оформить Pro"

    if trigger == "on_upload_exhausted":
        return Paywall(
            trigger=trigger,
            message="Вы исчерпали бесплатные загрузки в этом месяце.",
            cta=cta,
        )
    if trigger == "on_improve_all":
        hint = (
            f"Улучшите ещё {_humanise_ads(unimproved_left)} — "
            f"в тарифе Pro доступно 50 AI-улучшений в месяц."
            if unimproved_left > 0
            else "Переходите на Pro, чтобы улучшать десятки объявлений сразу."
        )
        return Paywall(
            trigger=trigger,
            message="Бесплатный лимит AI-улучшений закончился.",
            cta=cta,
            upgrade_hint=hint,
        )
    if trigger == "on_ads_per_upload":
        return Paywall(
            trigger=trigger,
            message="Файл слишком большой для бесплатного тарифа.",
            cta=cta,
            upgrade_hint="В Pro обрабатываем до 500 объявлений за раз.",
        )
    if trigger == "after_analysis":
        return Paywall(
            trigger=trigger,
            message="Снимайте ограничения и улучшайте десятки объявлений сразу.",
            cta=cta,
        )
    if trigger == "on_export_over_limit":
        return Paywall(trigger=trigger, message="Подпишитесь для экспорта.", cta=cta)
    return None
