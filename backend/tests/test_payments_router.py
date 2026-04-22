"""Integration tests for /billing/create-payment, /webhook, /status."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone


def _patch_create(monkeypatch, **overrides):
    payment_id = overrides.get("id", uuid.uuid4())
    result = {
        "id": payment_id,
        "provider": overrides.get("provider", "stub"),
        "provider_payment_id": overrides.get("provider_payment_id", "stub-1"),
        "status": overrides.get("status", "pending"),
        "confirmation_url": overrides.get(
            "confirmation_url",
            "http://localhost:3000/billing/success?id=x&stub=1",
        ),
    }

    async def _fake_create(_db, **_kwargs):
        return result

    monkeypatch.setattr("app.routers.billing.payments.create_payment", _fake_create)
    return result


def test_create_payment_requires_auth(anon_client):
    response = anon_client.post(
        "/billing/create-payment", json={"plan": "starter"}
    )
    assert response.status_code == 401


def test_create_payment_happy_path(auth_client, monkeypatch):
    expected = _patch_create(monkeypatch)
    response = auth_client.post(
        "/billing/create-payment", json={"plan": "starter"}
    )
    assert response.status_code == 201
    body = response.json()
    assert body["payment_id"] == str(expected["id"])
    assert body["confirmation_url"].startswith("http")
    assert body["status"] == "pending"


def test_create_payment_rejects_free_plan(auth_client):
    response = auth_client.post(
        "/billing/create-payment", json={"plan": "free"}
    )
    assert response.status_code == 422  # pydantic Literal mismatch


def test_create_payment_surfaces_provider_error(auth_client, monkeypatch):
    async def _boom(_db, **_kwargs):
        raise RuntimeError("provider offline")

    monkeypatch.setattr("app.routers.billing.payments.create_payment", _boom)

    response = auth_client.post(
        "/billing/create-payment", json={"plan": "starter"}
    )
    assert response.status_code == 502


def test_create_payment_requires_confirmation_url(auth_client, monkeypatch):
    _patch_create(monkeypatch, confirmation_url=None)
    response = auth_client.post(
        "/billing/create-payment", json={"plan": "pro"}
    )
    assert response.status_code == 502


# ---------------------------------------------------------------------
# Webhook
# ---------------------------------------------------------------------
class _FakeAdminSession:
    info: dict = {}

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return False

    async def commit(self):
        return None

    async def rollback(self):
        return None


def _patch_webhook(monkeypatch, result: dict):
    async def _fake_handle(_session, *, provider_name, payload):
        return result

    def _fake_admin():
        return _FakeAdminSession()

    monkeypatch.setattr("app.routers.billing.payments.handle_webhook", _fake_handle)
    monkeypatch.setattr(
        "app.routers.billing.AsyncSessionAdmin", lambda: _FakeAdminSession()
    )


def test_webhook_accepts_payload(anon_client, monkeypatch):
    _patch_webhook(
        monkeypatch,
        {
            "ok": True,
            "payment_id": "00000000-0000-0000-0000-000000000001",
            "user_id": "00000000-0000-0000-0000-000000000002",
            "plan": "starter",
            "status": "succeeded",
            "plan_granted": True,
        },
    )
    response = anon_client.post(
        "/billing/webhook",
        json={
            "event": "payment.succeeded",
            "object": {"id": "stub-1", "status": "succeeded"},
        },
    )
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_webhook_returns_ok_false_on_unknown_payment(anon_client, monkeypatch):
    _patch_webhook(monkeypatch, {"ok": False, "reason": "unknown_payment"})
    response = anon_client.post(
        "/billing/webhook",
        json={"event": "payment.succeeded", "object": {"id": "x", "status": "succeeded"}},
    )
    assert response.status_code == 200
    assert response.json()["ok"] is False


def test_webhook_rejects_invalid_json(anon_client):
    response = anon_client.post(
        "/billing/webhook",
        content=b"not json",
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 400


def test_webhook_rejects_forbidden_ip(anon_client, monkeypatch):
    # TestClient peers as 127.0.0.1 by default, which would be allowed
    # under the empty-allowlist dev fallback.  Force a non-loopback IP
    # via X-Forwarded-For (the router reads it first).
    response = anon_client.post(
        "/billing/webhook",
        json={"event": "payment.succeeded", "object": {"id": "x", "status": "succeeded"}},
        headers={"X-Forwarded-For": "203.0.113.5"},
    )
    # 404 rather than 403 — we don't advertise the surface to forgers.
    assert response.status_code == 404


# ---------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------
def _fake_payment_row(user_id, *, status="pending"):
    return {
        "id": uuid.uuid4(),
        "user_id": user_id,
        "plan": "starter",
        "amount": 129000,
        "currency": "RUB",
        "provider": "stub",
        "provider_payment_id": "stub-1",
        "status": status,
        "created_at": datetime.now(timezone.utc),
        "paid_at": None,
    }


def test_status_returns_payment_for_owner(auth_client, monkeypatch, test_user):
    row = _fake_payment_row(test_user.id, status="succeeded")

    async def _fake_get(_db, *, payment_id):
        return row

    monkeypatch.setattr("app.routers.billing.payments.get_payment", _fake_get)

    response = auth_client.get(f"/billing/status/{row['id']}")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "succeeded"
    assert body["amount"] == 129000
    assert body["plan"] == "starter"


def test_status_404_for_other_user(auth_client, monkeypatch):
    row = _fake_payment_row(uuid.uuid4())

    async def _fake_get(_db, *, payment_id):
        return row

    monkeypatch.setattr("app.routers.billing.payments.get_payment", _fake_get)

    response = auth_client.get(f"/billing/status/{row['id']}")
    assert response.status_code == 404


def test_status_404_when_missing(auth_client, monkeypatch):
    async def _fake_get(_db, *, payment_id):
        return None

    monkeypatch.setattr("app.routers.billing.payments.get_payment", _fake_get)

    response = auth_client.get(f"/billing/status/{uuid.uuid4()}")
    assert response.status_code == 404


def test_status_400_on_bad_uuid(auth_client):
    response = auth_client.get("/billing/status/not-a-uuid")
    assert response.status_code == 400


def test_status_requires_auth(anon_client):
    response = anon_client.get(f"/billing/status/{uuid.uuid4()}")
    assert response.status_code == 401
