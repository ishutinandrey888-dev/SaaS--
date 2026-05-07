"""Robokassa client: stub mode + signature verification."""

from __future__ import annotations

import asyncio
import hashlib
from types import SimpleNamespace

from app.services import payments_robokassa


def _settings(**over):
    base = dict(
        robokassa_merchant_login="",
        robokassa_password1="",
        robokassa_password2="",
        robokassa_test_mode=True,
        robokassa_webhook_ips="",
    )
    base.update(over)
    return SimpleNamespace(**base)


def test_stub_mode_returns_synthetic_url(monkeypatch):
    monkeypatch.setattr(
        "app.services.payments_robokassa.get_settings",
        lambda: _settings(),
    )
    pp = asyncio.run(
        payments_robokassa.create_payment(
            amount_minor=399000,
            currency="RUB",
            description="x",
            return_url="http://localhost/billing/success?id=ABC",
            idempotency_key="11111111-2222-3333-4444-555555555555",
        )
    )
    assert pp.provider == "stub"
    assert pp.confirmation_url and "stub=1" in pp.confirmation_url


def test_real_mode_signs_with_md5(monkeypatch):
    monkeypatch.setattr(
        "app.services.payments_robokassa.get_settings",
        lambda: _settings(
            robokassa_merchant_login="shopX",
            robokassa_password1="pwd1",
            robokassa_password2="pwd2",
            robokassa_test_mode=False,
        ),
    )
    pp = asyncio.run(
        payments_robokassa.create_payment(
            amount_minor=399000,
            currency="RUB",
            description="Pro",
            return_url="http://localhost/billing/success?id=11111111-2222-3333-4444-555555555555",
            idempotency_key="11111111-2222-3333-4444-555555555555",
        )
    )
    assert pp.provider == "robokassa"
    assert pp.confirmation_url is not None
    # Signature should be an uppercased MD5 over MerchantLogin:OutSum:InvId:pwd1
    inv_id = int("11111111", 16)
    expected = hashlib.md5(f"shopX:3990.00:{inv_id}:pwd1".encode()).hexdigest().upper()
    assert f"SignatureValue={expected}" in pp.confirmation_url


def test_signature_verification_happy(monkeypatch):
    monkeypatch.setattr(
        "app.services.payments_robokassa.get_settings",
        lambda: _settings(robokassa_password2="pwd2"),
    )
    sig = hashlib.md5(b"3990.00:42:pwd2").hexdigest().upper()
    assert payments_robokassa.verify_webhook_signature(
        {"OutSum": "3990.00", "InvId": "42", "SignatureValue": sig}
    )


def test_signature_verification_rejects_bad_signature(monkeypatch):
    monkeypatch.setattr(
        "app.services.payments_robokassa.get_settings",
        lambda: _settings(robokassa_password2="pwd2"),
    )
    assert not payments_robokassa.verify_webhook_signature(
        {"OutSum": "3990.00", "InvId": "42", "SignatureValue": "0" * 32}
    )


def test_signature_includes_shp_params(monkeypatch):
    monkeypatch.setattr(
        "app.services.payments_robokassa.get_settings",
        lambda: _settings(robokassa_password2="pwd2"),
    )
    sig = hashlib.md5(
        b"3990.00:42:pwd2:shp_internal=internal-id:shp_plan=pro"
    ).hexdigest().upper()
    assert payments_robokassa.verify_webhook_signature(
        {
            "OutSum": "3990.00",
            "InvId": "42",
            "SignatureValue": sig,
            "shp_plan": "pro",
            "shp_internal": "internal-id",
        }
    )


def test_parse_webhook_extracts_inv_id():
    assert payments_robokassa.parse_webhook(
        {"InvId": "42", "OutSum": "3990.00", "SignatureValue": "x"}
    ) == ("42", "succeeded")


def test_ip_allowlist_empty_means_no_restriction(monkeypatch):
    monkeypatch.setattr(
        "app.services.payments_robokassa.get_settings",
        lambda: _settings(),
    )
    assert payments_robokassa.is_webhook_source_allowed("203.0.113.5") is True
    assert payments_robokassa.is_webhook_source_allowed("127.0.0.1") is True


def test_ip_allowlist_honoured(monkeypatch):
    monkeypatch.setattr(
        "app.services.payments_robokassa.get_settings",
        lambda: _settings(robokassa_webhook_ips="185.71.76.0/27"),
    )
    assert payments_robokassa.is_webhook_source_allowed("185.71.76.5") is True
    assert payments_robokassa.is_webhook_source_allowed("8.8.8.8") is False
