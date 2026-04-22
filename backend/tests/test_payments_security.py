"""Unit tests for webhook IP allowlist + plan-expiry enforcement."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.services import billing, payments_yookassa


# ---------------------------------------------------------------------
# Webhook allowlist
# ---------------------------------------------------------------------
def test_empty_allowlist_allows_loopback(monkeypatch):
    monkeypatch.setattr(
        "app.services.payments_yookassa.get_settings",
        lambda: SimpleNamespace(yukassa_webhook_ips=""),
    )
    assert payments_yookassa.is_webhook_source_allowed("127.0.0.1") is True
    assert payments_yookassa.is_webhook_source_allowed("::1") is True


def test_empty_allowlist_denies_public_ip(monkeypatch):
    monkeypatch.setattr(
        "app.services.payments_yookassa.get_settings",
        lambda: SimpleNamespace(yukassa_webhook_ips=""),
    )
    assert payments_yookassa.is_webhook_source_allowed("203.0.113.5") is False


def test_configured_cidr_is_honoured(monkeypatch):
    monkeypatch.setattr(
        "app.services.payments_yookassa.get_settings",
        lambda: SimpleNamespace(yukassa_webhook_ips="185.71.76.0/27, 185.71.77.0/27"),
    )
    assert payments_yookassa.is_webhook_source_allowed("185.71.76.5") is True
    assert payments_yookassa.is_webhook_source_allowed("185.71.77.10") is True
    # When allowlist is non-empty, loopback is NOT implicitly allowed.
    assert payments_yookassa.is_webhook_source_allowed("127.0.0.1") is False
    assert payments_yookassa.is_webhook_source_allowed("203.0.113.5") is False


def test_malformed_ip_denied(monkeypatch):
    monkeypatch.setattr(
        "app.services.payments_yookassa.get_settings",
        lambda: SimpleNamespace(yukassa_webhook_ips=""),
    )
    assert payments_yookassa.is_webhook_source_allowed("not-an-ip") is False
    assert payments_yookassa.is_webhook_source_allowed(None) is False
    assert payments_yookassa.is_webhook_source_allowed("") is False


def test_malformed_cidr_entries_skipped(monkeypatch):
    monkeypatch.setattr(
        "app.services.payments_yookassa.get_settings",
        lambda: SimpleNamespace(
            yukassa_webhook_ips="garbage, 185.71.76.0/27, also_bad"
        ),
    )
    # Good entries still work; bad entries just get logged and skipped.
    assert payments_yookassa.is_webhook_source_allowed("185.71.76.5") is True


# ---------------------------------------------------------------------
# Effective plan (expiry enforcement)
# ---------------------------------------------------------------------
def _user(plan: str, expires_at):
    return SimpleNamespace(plan=plan, plan_expires_at=expires_at)


def test_free_plan_stays_free_with_no_expiry():
    assert billing.get_effective_plan(_user("free", None)) == "free"


def test_paid_plan_without_expiry_is_indefinite():
    # Legacy rows / admin grants: no expiry = keep the plan.
    assert billing.get_effective_plan(_user("pro", None)) == "pro"


def test_paid_plan_within_window_honored():
    future = datetime.now(timezone.utc) + timedelta(days=5)
    assert billing.get_effective_plan(_user("starter", future)) == "starter"


def test_expired_plan_downgrades_to_free():
    past = datetime.now(timezone.utc) - timedelta(days=1)
    assert billing.get_effective_plan(_user("starter", past)) == "free"
    assert billing.get_effective_plan(_user("pro", past)) == "free"


def test_plan_expires_exactly_now_is_expired():
    now = datetime.now(timezone.utc)
    # Inclusive: expires_at <= now → free.
    assert billing.get_effective_plan(_user("pro", now), now=now) == "free"
