"""Integration tests for POST /start/generate."""

from __future__ import annotations

from app.services import billing


def _patch_usage(monkeypatch, *, plan="free", used=0, remaining=3):
    async def _fake_get_usage(_db, _uid, plan_id, _lifetime, **_):
        return billing.UsageSnapshot(
            plan=plan_id if plan_id in {"free", "starter", "pro"} else "free",
            uploads_used=0,
            uploads_limit=billing.get_plan(plan_id).uploads_per_month,
            ai_ads_used=used,
            ai_ads_limit=billing.get_plan(plan_id).ai_ads_per_period,
            ai_ads_remaining=remaining,
        )

    async def _fake_consume(*_args, **_kwargs):
        return None

    monkeypatch.setattr("app.routers.start.billing.get_usage", _fake_get_usage)
    monkeypatch.setattr("app.routers.start.billing.consume_usage", _fake_consume)


def _brief(count: int = 3) -> dict:
    return {
        "product": "Онлайн-курс по Python",
        "audience": "Начинающие разработчики 20-35",
        "region": "Москва",
        "keywords": ["курсы python", "обучение программированию"],
        "tone": "confident",
        "count": count,
    }


def _fake_ad(i: int) -> dict:
    return {
        "headline": f"Сгенерированный заголовок {i}",
        "headline2": None,
        "text": "Отличный текст с CTA и цифрами.",
        "keywords": ["ключ"],
        "reasoning": "Тестовая причина.",
    }


def test_start_requires_auth(anon_client):
    response = anon_client.post("/start/generate", json=_brief())
    assert response.status_code == 401


def test_start_happy_path(auth_client, monkeypatch):
    _patch_usage(monkeypatch, remaining=5)

    async def _fake_generate(brief):
        return [_fake_ad(i) for i in range(brief["count"])]

    monkeypatch.setattr("app.services.ai_start.generate_ads", _fake_generate)

    response = auth_client.post("/start/generate", json=_brief(3))
    assert response.status_code == 200
    body = response.json()
    assert body["requested_count"] == 3
    assert body["generated_count"] == 3
    assert len(body["ads"]) == 3
    assert body["paywall"] is None
    assert body["ads"][0]["headline"].startswith("Сгенерированный")


def test_start_partial_when_budget_short(auth_client, monkeypatch):
    _patch_usage(monkeypatch, used=1, remaining=2)

    async def _fake_generate(brief):
        # The router clamps `count` to allowed budget before calling us.
        return [_fake_ad(i) for i in range(brief["count"])]

    monkeypatch.setattr("app.services.ai_start.generate_ads", _fake_generate)

    response = auth_client.post("/start/generate", json=_brief(5))
    assert response.status_code == 200
    body = response.json()
    assert body["requested_count"] == 5
    assert body["generated_count"] == 2
    assert body["paywall"] is not None
    assert body["paywall"]["trigger"] == "on_improve_all"


def test_start_zero_budget_returns_empty(auth_client, monkeypatch):
    _patch_usage(monkeypatch, used=3, remaining=0)

    async def _unreachable(_brief):
        raise AssertionError("generator should not be called")

    monkeypatch.setattr("app.services.ai_start.generate_ads", _unreachable)

    response = auth_client.post("/start/generate", json=_brief(3))
    assert response.status_code == 200
    body = response.json()
    assert body["generated_count"] == 0
    assert body["ads"] == []
    assert body["paywall"] is not None
    assert body["paywall"]["trigger"] == "on_improve_all"


def test_start_handles_ai_empty_response(auth_client, monkeypatch):
    _patch_usage(monkeypatch, remaining=5)

    async def _fake_generate(_brief):
        return []  # simulate AI timeout / bad JSON

    monkeypatch.setattr("app.services.ai_start.generate_ads", _fake_generate)

    response = auth_client.post("/start/generate", json=_brief(3))
    assert response.status_code == 200
    body = response.json()
    assert body["generated_count"] == 0
    assert body["requested_count"] == 3
    # No spend, no paywall on pure AI failure.
    assert body["paywall"] is None


def test_start_pro_plan_no_paywall(auth_client, monkeypatch):
    async def _fake_get_usage(_db, _uid, _plan_id, _lifetime, **_):
        return billing.UsageSnapshot(
            plan="pro",
            uploads_used=0,
            uploads_limit=100,
            ai_ads_used=0,
            ai_ads_limit=None,
            ai_ads_remaining=None,
        )

    async def _fake_consume(*_args, **_kwargs):
        return None

    async def _fake_generate(brief):
        return [_fake_ad(i) for i in range(brief["count"])]

    monkeypatch.setattr("app.routers.start.billing.get_usage", _fake_get_usage)
    monkeypatch.setattr("app.routers.start.billing.consume_usage", _fake_consume)
    monkeypatch.setattr("app.services.ai_start.generate_ads", _fake_generate)

    response = auth_client.post("/start/generate", json=_brief(4))
    assert response.status_code == 200
    body = response.json()
    assert body["generated_count"] == 4
    assert body["paywall"] is None


def test_start_rejects_empty_product(auth_client):
    bad = _brief()
    bad["product"] = ""
    response = auth_client.post("/start/generate", json=bad)
    assert response.status_code == 422


def test_start_rejects_out_of_range_count(auth_client):
    bad = _brief()
    bad["count"] = 50
    response = auth_client.post("/start/generate", json=bad)
    assert response.status_code == 422
