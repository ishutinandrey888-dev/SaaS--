"""Integration tests for GET /dashboard."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.services import billing


def _patch_usage(monkeypatch, *, plan="free", remaining=3):
    async def _fake(_db, _uid, plan_id, _lifetime, **_):
        return billing.UsageSnapshot(
            plan=plan_id if plan_id in {"free", "starter", "pro"} else "free",
            uploads_used=1,
            uploads_limit=billing.get_plan(plan_id).uploads_per_month,
            ai_ads_used=0,
            ai_ads_limit=billing.get_plan(plan_id).ai_ads_per_period,
            ai_ads_remaining=remaining,
        )

    monkeypatch.setattr("app.routers.dashboard.billing.get_usage", _fake)


def test_dashboard_requires_auth(anon_client):
    response = anon_client.get("/dashboard")
    assert response.status_code == 401


def test_dashboard_empty_history_returns_zeros(auth_client, monkeypatch):
    _patch_usage(monkeypatch)

    response = auth_client.get("/dashboard")
    assert response.status_code == 200

    body = response.json()
    assert body["plan"] == "free"
    assert body["limits"]["plan"] == "free"
    assert body["history"] == []
    assert body["totals"] == {
        "uploads": 0,
        "ads": 0,
        "improved": 0,
        "avg_score": 0.0,
    }
    assert body["history_days"] == 7


def test_dashboard_returns_history_and_totals(test_user, monkeypatch):
    """Use a richer fake DB so we can assert mapping → response shape."""
    from fastapi.testclient import TestClient

    from app.core.database import get_db_user
    from app.main import app
    from app.middleware.auth import get_current_user, get_optional_user
    from app.middleware.rate_limit import limiter
    from app.services import audit as audit_mod

    limiter.enabled = False

    rows = [
        {
            "id": uuid.uuid4(),
            "filename": "campaign-a.xlsx",
            "total_ads": 12,
            "total_campaigns": 2,
            "improved_count": 3,
            "weak_ads_percent": 25,
            "avg_score": 78.5,
            "created_at": datetime.now(timezone.utc) - timedelta(hours=1),
        },
        {
            "id": uuid.uuid4(),
            "filename": "campaign-b.xlsx",
            "total_ads": 6,
            "total_campaigns": 1,
            "improved_count": 2,
            "weak_ads_percent": 50,
            "avg_score": 60.0,
            "created_at": datetime.now(timezone.utc) - timedelta(days=2),
        },
    ]
    totals_row = {
        "uploads": len(rows),
        "ads": sum(r["total_ads"] for r in rows),
        "improved": sum(r["improved_count"] for r in rows),
        "avg_score": (78.5 + 60.0) / 2,
    }

    class _Mapping:
        def __init__(self, items):
            self._items = items

        def all(self):
            return list(self._items)

        def first(self):
            return self._items[0] if self._items else None

    class _Result:
        def __init__(self, items, single=None):
            self._items = items
            self._single = single

        def mappings(self):
            return _Mapping(self._items)

        def first(self):
            return self._single

        def scalar(self):
            return None

    class _Session:
        info: dict = {}

        async def execute(self, stmt, _params=None):
            sql = str(stmt).lower()
            if "from upload_history" in sql and "count" in sql:
                return _Result([totals_row])
            if "from upload_history" in sql:
                return _Result(rows)
            return _Result([])

    async def _user_dep():
        return test_user

    async def _db_dep():
        yield _Session()

    async def _audit_noop(**_kwargs):
        return None

    async def _fake_usage(_db, _uid, plan_id, _lifetime, **_):
        return billing.UsageSnapshot(
            plan="starter",
            uploads_used=2,
            uploads_limit=20,
            ai_ads_used=5,
            ai_ads_limit=50,
            ai_ads_remaining=45,
        )

    test_user.plan = "starter"
    monkeypatch.setattr("app.routers.dashboard.billing.get_usage", _fake_usage)
    monkeypatch.setattr(audit_mod, "log", _audit_noop)
    app.dependency_overrides[get_current_user] = _user_dep
    app.dependency_overrides[get_optional_user] = _user_dep
    app.dependency_overrides[get_db_user] = _db_dep

    try:
        client = TestClient(app)
        response = client.get("/dashboard")
        assert response.status_code == 200

        body = response.json()
        assert body["plan"] == "starter"
        assert body["history_days"] == 30
        assert len(body["history"]) == 2
        assert body["history"][0]["filename"] == "campaign-a.xlsx"
        assert body["history"][0]["avg_score"] == 78.5
        assert body["totals"]["uploads"] == 2
        assert body["totals"]["ads"] == 18
        assert body["totals"]["improved"] == 5
    finally:
        app.dependency_overrides.clear()
        limiter.enabled = True
