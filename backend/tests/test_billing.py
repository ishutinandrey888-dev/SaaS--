"""Unit tests for billing helpers (no DB)."""

from __future__ import annotations

from datetime import datetime, timezone

from app.services import billing


def test_get_plan_unknown_falls_back_to_free():
    assert billing.get_plan(None).id == "free"
    assert billing.get_plan("enterprise").id == "free"
    assert billing.get_plan("starter").id == "starter"


def test_current_period_is_yyyy_mm():
    now = datetime(2026, 4, 21, 12, 0, tzinfo=timezone.utc)
    assert billing.current_period(now) == "2026-04"


def test_cap_ads_per_upload_trims_on_free():
    allowed, trimmed = billing.cap_ads_per_upload(200, "free")
    assert allowed == 50
    assert trimmed is True

    allowed, trimmed = billing.cap_ads_per_upload(10, "free")
    assert allowed == 10
    assert trimmed is False


def test_cap_ads_per_upload_generous_on_pro():
    allowed, trimmed = billing.cap_ads_per_upload(1500, "pro")
    assert allowed == 1500
    assert trimmed is False


def _snapshot(*, plan="free", used=0, limit=3, remaining=3):
    return billing.UsageSnapshot(
        plan=plan,
        uploads_used=0,
        uploads_limit=3,
        ai_ads_used=used,
        ai_ads_limit=limit,
        ai_ads_remaining=remaining,
    )


def test_cap_ai_budget_partial_when_short():
    allowed, capped = billing.cap_ai_budget(10, _snapshot(remaining=3))
    assert allowed == 3
    assert capped is True


def test_cap_ai_budget_exact_when_fits():
    allowed, capped = billing.cap_ai_budget(2, _snapshot(remaining=5))
    assert allowed == 2
    assert capped is False


def test_cap_ai_budget_unlimited_on_pro():
    snap = billing.UsageSnapshot(
        plan="pro",
        uploads_used=0,
        uploads_limit=100,
        ai_ads_used=0,
        ai_ads_limit=None,
        ai_ads_remaining=None,
    )
    allowed, capped = billing.cap_ai_budget(500, snap)
    assert allowed == 500
    assert capped is False


def test_cap_ai_budget_zero_when_exhausted():
    allowed, capped = billing.cap_ai_budget(5, _snapshot(remaining=0))
    assert allowed == 0
    assert capped is True


def test_build_paywall_improve_all_has_hint_with_russian_plural():
    pw = billing.build_paywall(
        "on_improve_all", plan="free", unimproved_left=15
    )
    assert pw is not None
    assert pw.trigger == "on_improve_all"
    assert pw.cta == "Оформить Starter"
    assert "15" in (pw.upgrade_hint or "")
    assert "объявлени" in (pw.upgrade_hint or "")


def test_build_paywall_returns_none_on_pro():
    pw = billing.build_paywall("on_improve_all", plan="pro")
    assert pw is None


def test_build_paywall_upload_exhausted():
    pw = billing.build_paywall("on_upload_exhausted", plan="free")
    assert pw is not None
    assert pw.trigger == "on_upload_exhausted"
    assert "исчерпали" in pw.message.lower()


def test_check_upload_allowed_raises_when_exhausted():
    snap = billing.UsageSnapshot(
        plan="free",
        uploads_used=3,
        uploads_limit=3,
        ai_ads_used=0,
        ai_ads_limit=3,
        ai_ads_remaining=3,
    )
    try:
        billing.check_upload_allowed(snap)
    except billing.LimitExceeded as exc:
        assert exc.trigger == "on_upload_exhausted"
        assert exc.remaining == 0
    else:
        raise AssertionError("expected LimitExceeded")


def test_check_upload_allowed_ok_when_room():
    billing.check_upload_allowed(_snapshot())  # must not raise
