"""Unit tests for payments service logic (status mapping, webhook shape)."""

from __future__ import annotations

from app.services import payments, payments_yookassa


def test_map_status_yookassa_succeeded():
    assert payments._map_provider_status("yookassa", "succeeded") == "succeeded"


def test_map_status_yookassa_waiting_is_pending():
    assert (
        payments._map_provider_status("yookassa", "waiting_for_capture") == "pending"
    )


def test_map_status_yookassa_canceled():
    assert payments._map_provider_status("yookassa", "canceled") == "canceled"


def test_map_status_yookassa_unknown_defaults_to_pending():
    assert payments._map_provider_status("yookassa", "zalgo") == "pending"


def test_map_status_stub_succeeds_on_pending():
    # Stub provider always returns pending but we treat it as success
    # so dev flows complete without a real webhook roundtrip.
    assert payments._map_provider_status("stub", "pending") == "succeeded"
    assert payments._map_provider_status("stub", "succeeded") == "succeeded"


def test_parse_webhook_happy():
    parsed = payments_yookassa.parse_webhook(
        {
            "event": "payment.succeeded",
            "object": {"id": "2abc", "status": "succeeded"},
        }
    )
    assert parsed == ("2abc", "succeeded")


def test_parse_webhook_missing_object():
    assert payments_yookassa.parse_webhook({"event": "x"}) is None


def test_parse_webhook_wrong_types():
    assert (
        payments_yookassa.parse_webhook({"object": {"id": 1, "status": "ok"}}) is None
    )
