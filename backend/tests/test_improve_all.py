"""Integration tests for POST /excel/improve-all."""

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

    monkeypatch.setattr("app.routers.excel.billing.get_usage", _fake_get_usage)
    monkeypatch.setattr("app.routers.excel.billing.consume_usage", _fake_consume)


async def _fake_improve(_ad):
    return {
        "headline": "AI-заголовок",
        "text": "AI-текст с CTA, цифрами и ключами.",
        "reasoning": "Уточнён CTA.",
    }


def _ad_payload(rows: list[int]):
    return {
        "ads": [
            {
                "row": r,
                "campaign": "Кампания",
                "group": "Группа 1",
                "headline": f"Старый заголовок {r}",
                "headline2": None,
                "text": f"Старый текст {r}.",
                "keywords": ["ключ"],
            }
            for r in rows
        ]
    }


def test_improve_all_requires_auth(anon_client):
    response = anon_client.post("/excel/improve-all", json=_ad_payload([2, 3]))
    assert response.status_code == 401


def test_improve_all_happy_path(auth_client, monkeypatch):
    _patch_usage(monkeypatch, remaining=5)
    monkeypatch.setattr("app.services.ai_ads.improve_ad", _fake_improve)

    response = auth_client.post(
        "/excel/improve-all", json=_ad_payload([2, 3, 4])
    )
    assert response.status_code == 200
    body = response.json()
    assert body["improved_count"] == 3
    assert body["requested_count"] == 3
    assert body["paywall"] is None
    rows = {item["row"] for item in body["improved"]}
    assert rows == {2, 3, 4}
    for item in body["improved"]:
        assert item["improved"]["headline"] == "AI-заголовок"


def test_improve_all_partial_when_budget_short(auth_client, monkeypatch):
    _patch_usage(monkeypatch, used=1, remaining=2)
    monkeypatch.setattr("app.services.ai_ads.improve_ad", _fake_improve)

    response = auth_client.post(
        "/excel/improve-all", json=_ad_payload([10, 11, 12, 13, 14])
    )
    assert response.status_code == 200
    body = response.json()
    assert body["improved_count"] == 2
    assert body["requested_count"] == 5
    assert body["paywall"] is not None
    assert body["paywall"]["trigger"] == "on_improve_all"


def test_improve_all_zero_budget_returns_empty(auth_client, monkeypatch):
    _patch_usage(monkeypatch, used=3, remaining=0)
    monkeypatch.setattr("app.services.ai_ads.improve_ad", _fake_improve)

    response = auth_client.post(
        "/excel/improve-all", json=_ad_payload([1, 2])
    )
    assert response.status_code == 200
    body = response.json()
    assert body["improved_count"] == 0
    assert body["improved"] == []
    assert body["paywall"] is not None
    assert body["paywall"]["trigger"] == "on_improve_all"


def test_improve_all_swallows_ai_failures(auth_client, monkeypatch):
    _patch_usage(monkeypatch, remaining=5)

    call_count = {"n": 0}

    async def _mixed(_ad):
        call_count["n"] += 1
        if call_count["n"] == 1:
            raise RuntimeError("timeout")
        return {
            "headline": "ok",
            "text": "ok text with cta.",
            "reasoning": "ok",
        }

    monkeypatch.setattr("app.services.ai_ads.improve_ad", _mixed)

    response = auth_client.post(
        "/excel/improve-all", json=_ad_payload([1, 2, 3])
    )
    assert response.status_code == 200
    body = response.json()
    # One failed → only 2 got improved rather than 3.
    assert body["improved_count"] == 2
    assert len(body["improved"]) == 2


def test_improve_all_pro_plan_no_paywall(auth_client, monkeypatch):
    # Pro: unlimited AI → remaining=None.
    async def _fake_get_usage(_db, _uid, plan_id, _lifetime, **_):
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

    monkeypatch.setattr("app.routers.excel.billing.get_usage", _fake_get_usage)
    monkeypatch.setattr("app.routers.excel.billing.consume_usage", _fake_consume)
    monkeypatch.setattr("app.services.ai_ads.improve_ad", _fake_improve)

    response = auth_client.post(
        "/excel/improve-all", json=_ad_payload([1, 2])
    )
    assert response.status_code == 200
    body = response.json()
    assert body["improved_count"] == 2
    assert body["paywall"] is None


def test_improve_all_rejects_empty_list(auth_client):
    response = auth_client.post("/excel/improve-all", json={"ads": []})
    assert response.status_code == 422
