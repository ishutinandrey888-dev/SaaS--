"""Integration tests: billing-aware /excel/upload + /billing/*."""

from __future__ import annotations

import io

import pytest
from openpyxl import Workbook

from app.services import billing

_XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _sample_xlsx(n: int = 4) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.append(["Название кампании", "Название группы", "Заголовок 1", "Текст", "Ключевые фразы"])
    for i in range(n):
        ws.append([
            "Кампания 1",
            f"Группа {i}",
            f"Купить товар {i}",
            f"Закажите сегодня — доставка, гарантия. Товар {i}.",
            f"товар {i}",
        ])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _patch_usage(monkeypatch, *, plan="free", used=0, remaining=3, uploads_used=0):
    async def _fake_get_usage(_db, _uid, plan_id, _lifetime, **_):
        return billing.UsageSnapshot(
            plan=plan_id if plan_id in {"free", "starter", "pro"} else "free",
            uploads_used=uploads_used,
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
        "headline": "Улучшенный заголовок",
        "text": "Улучшенный текст с призывом к действию.",
        "reasoning": "Добавлен CTA.",
    }


# ---------------------------------------------------------------------
# Upload — free plan response contract
# ---------------------------------------------------------------------
def test_upload_returns_plan_limits_usage_on_free(auth_client, monkeypatch):
    _patch_usage(monkeypatch, remaining=3)
    monkeypatch.setattr("app.services.ai_ads.improve_ad", _fake_improve)

    files = {"file": ("ads.xlsx", _sample_xlsx(2), _XLSX_MIME)}
    response = auth_client.post("/excel/upload", files=files)
    assert response.status_code == 200

    body = response.json()
    assert body["plan"] == "free"
    assert body["limits"]["plan"] == "free"
    assert body["limits"]["ai_ads"] == 3
    assert body["limits"]["max_ads_per_upload"] == 50
    assert body["limits"]["watermark"] is True
    assert "uploads_used" in body["usage"]
    assert body["summary"]["improved_count"] == 2


# ---------------------------------------------------------------------
# Upload — AI lifetime cap bites → partial + paywall
# ---------------------------------------------------------------------
def test_upload_ai_cap_bites_partial_and_paywall(auth_client, monkeypatch):
    # 2 AI calls allowed remain, but we have 4 ads → improve 2, rest null,
    # paywall trigger `on_improve_all`.
    _patch_usage(monkeypatch, used=1, remaining=2)
    monkeypatch.setattr("app.services.ai_ads.improve_ad", _fake_improve)

    files = {"file": ("ads.xlsx", _sample_xlsx(4), _XLSX_MIME)}
    response = auth_client.post("/excel/upload", files=files)
    assert response.status_code == 200

    body = response.json()
    assert body["summary"]["improved_count"] == 2
    assert body["paywall"] is not None
    assert body["paywall"]["trigger"] == "on_improve_all"
    assert body["paywall"]["cta"] == "Оформить Starter"
    assert body["paywall"].get("upgrade_hint")


# ---------------------------------------------------------------------
# Upload — zero AI remaining → audit only, paywall
# ---------------------------------------------------------------------
def test_upload_no_ai_budget_returns_audit_only(auth_client, monkeypatch):
    _patch_usage(monkeypatch, used=3, remaining=0)
    monkeypatch.setattr("app.services.ai_ads.improve_ad", _fake_improve)

    files = {"file": ("ads.xlsx", _sample_xlsx(2), _XLSX_MIME)}
    response = auth_client.post("/excel/upload", files=files)
    assert response.status_code == 200

    body = response.json()
    assert body["summary"]["improved_count"] == 0
    assert all(ad["improved"] is None for ad in body["ads"])
    assert body["paywall"] is not None
    assert body["paywall"]["trigger"] in {"on_improve_all", "after_analysis"}


# ---------------------------------------------------------------------
# Upload — monthly upload quota exhausted → no ads, paywall
# ---------------------------------------------------------------------
def test_upload_quota_exhausted_returns_paywall_only(auth_client, monkeypatch):
    _patch_usage(monkeypatch, uploads_used=3, remaining=3)
    monkeypatch.setattr("app.services.ai_ads.improve_ad", _fake_improve)

    files = {"file": ("ads.xlsx", _sample_xlsx(2), _XLSX_MIME)}
    response = auth_client.post("/excel/upload", files=files)
    assert response.status_code == 200

    body = response.json()
    assert body["ads"] == []
    assert body["summary"]["total_ads"] == 0
    assert body["paywall"] is not None
    assert body["paywall"]["trigger"] == "on_upload_exhausted"


# ---------------------------------------------------------------------
# /billing/plans — public catalog
# ---------------------------------------------------------------------
def test_plans_catalog_is_public(anon_client):
    response = anon_client.get("/billing/plans")
    assert response.status_code == 200
    body = response.json()
    assert len(body["plans"]) == 3
    ids = {p["id"] for p in body["plans"]}
    assert ids == {"free", "starter", "pro"}
    free = next(p for p in body["plans"] if p["id"] == "free")
    assert free["ai_ads_per_period"] == 3
    assert free["watermark"] is True


# ---------------------------------------------------------------------
# /billing/upgrade-intent — stub + audit
# ---------------------------------------------------------------------
def test_upgrade_intent_requires_auth(anon_client):
    response = anon_client.post("/billing/upgrade-intent", json={"plan": "starter"})
    assert response.status_code == 401


def test_upgrade_intent_accepts_and_logs(auth_client, monkeypatch):
    logged: list[dict] = []

    async def _log(**kwargs):
        logged.append(kwargs)

    monkeypatch.setattr("app.routers.billing.audit.log", _log)

    response = auth_client.post(
        "/billing/upgrade-intent",
        json={
            "plan": "starter",
            "trigger": "on_improve_all",
            "context": {"ads_left": 15},
        },
    )
    assert response.status_code == 202
    body = response.json()
    assert body["accepted"] is True
    assert logged and logged[0]["meta"]["target_plan"] == "starter"
    assert logged[0]["meta"]["trigger"] == "on_improve_all"


def test_upgrade_intent_rejects_bad_plan(auth_client):
    response = auth_client.post(
        "/billing/upgrade-intent", json={"plan": "enterprise"}
    )
    assert response.status_code == 422
