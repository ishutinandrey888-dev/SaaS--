"""Integration tests for /admin/metrics."""

from __future__ import annotations

from app.services import metrics


def _patch_funnel(monkeypatch, **fields):
    base = {
        "signups": 100,
        "uploaders": 60,
        "improvers": 30,
        "payers": 10,
        "revenue_minor": 1290000,
    }
    base.update(fields)
    funnel = metrics.FunnelMetrics(**base)

    async def _fake_compute(_session):
        return funnel

    # Side-step the AsyncSessionAdmin context manager — the router opens
    # one and never commits, so a no-op stand-in is enough.
    class _FakeSession:
        info: dict = {}

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return False

    monkeypatch.setattr("app.routers.admin.metrics.compute_funnel", _fake_compute)
    monkeypatch.setattr("app.routers.admin.AsyncSessionAdmin", lambda: _FakeSession())
    return funnel


def test_metrics_404_for_non_admin(auth_client, monkeypatch, test_user):
    # ADMIN_EMAILS empty by default → no one is admin.
    monkeypatch.setattr(
        "app.routers.admin.get_settings",
        lambda: type("S", (), {"admin_email_set": set()})(),
    )
    response = auth_client.get("/admin/metrics")
    assert response.status_code == 404


def test_metrics_requires_auth(anon_client):
    response = anon_client.get("/admin/metrics")
    assert response.status_code == 401


def test_metrics_returns_funnel_for_admin(auth_client, monkeypatch, test_user):
    monkeypatch.setattr(
        "app.routers.admin.get_settings",
        lambda: type("S", (), {"admin_email_set": {test_user.email.lower()}})(),
    )
    _patch_funnel(monkeypatch)

    response = auth_client.get("/admin/metrics")
    assert response.status_code == 200
    body = response.json()
    assert body["signups"] == 100
    assert body["uploaders"] == 60
    assert body["improvers"] == 30
    assert body["payers"] == 10
    assert body["revenue_minor"] == 1290000
    # Conversion ratios are computed server-side.
    assert body["upload_rate"] == 0.6
    assert body["improve_rate"] == 0.5
    assert body["pay_rate"] == round(10 / 30, 4)


def test_metrics_zero_signups_doesnt_divide(auth_client, monkeypatch, test_user):
    monkeypatch.setattr(
        "app.routers.admin.get_settings",
        lambda: type("S", (), {"admin_email_set": {test_user.email.lower()}})(),
    )
    _patch_funnel(
        monkeypatch,
        signups=0,
        uploaders=0,
        improvers=0,
        payers=0,
        revenue_minor=0,
    )

    response = auth_client.get("/admin/metrics")
    assert response.status_code == 200
    body = response.json()
    assert body["upload_rate"] == 0.0
    assert body["improve_rate"] == 0.0
    assert body["pay_rate"] == 0.0
