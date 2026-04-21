"""Integration tests for async /excel/jobs endpoints.

Celery is mocked: we patch `process_upload_task.delay` (enqueue side)
and `celery.result.AsyncResult` (poll side) so the tests never touch
Redis or a live worker.
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from typing import Any

import pytest
from openpyxl import Workbook

_XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _sample_xlsx() -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.append(
        ["Название кампании", "Название группы", "Заголовок 1", "Текст", "Ключевые фразы"]
    )
    ws.append(
        ["Кампания", "Группа", "Купить товар", "Закажите сегодня — доставка.", "товар"]
    )
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


@dataclass
class _FakeAsyncResult:
    id: str = "fake-job-id"


def test_create_job_requires_auth(anon_client):
    files = {"file": ("ads.xlsx", _sample_xlsx(), _XLSX_MIME)}
    response = anon_client.post("/excel/jobs", files=files)
    assert response.status_code == 401


def test_create_job_returns_id_and_queued(auth_client, monkeypatch):
    captured: dict[str, Any] = {}

    def _fake_delay(**kwargs):
        captured.update(kwargs)
        return _FakeAsyncResult(id="job-123")

    monkeypatch.setattr(
        "app.tasks.excel_jobs.process_upload_task.delay", _fake_delay
    )

    files = {"file": ("ads.xlsx", _sample_xlsx(), _XLSX_MIME)}
    response = auth_client.post("/excel/jobs", files=files)
    assert response.status_code == 202

    body = response.json()
    assert body["job_id"] == "job-123"
    assert body["state"] == "queued"
    assert captured["plan_id"] == "free"
    assert captured["filename"] == "ads.xlsx"
    assert isinstance(captured["file_bytes"], bytes)
    assert len(captured["file_bytes"]) > 100


def test_create_job_rejects_non_xlsx(auth_client, monkeypatch):
    def _unreachable(**_):
        raise AssertionError("task should not be enqueued")

    monkeypatch.setattr(
        "app.tasks.excel_jobs.process_upload_task.delay", _unreachable
    )

    files = {"file": ("x.txt", b"not excel", "text/plain")}
    response = auth_client.post("/excel/jobs", files=files)
    assert response.status_code == 400


# ---------------------------------------------------------------------
# GET /excel/jobs/{id}
# ---------------------------------------------------------------------
class _StubResult:
    def __init__(self, state: str, result: Any = None):
        self.state = state
        self.result = result


def _patch_async_result(monkeypatch, stub: _StubResult):
    def _factory(_job_id, app=None):
        return stub

    monkeypatch.setattr("celery.result.AsyncResult", _factory)


def test_job_state_queued(auth_client, monkeypatch):
    _patch_async_result(monkeypatch, _StubResult("PENDING"))
    response = auth_client.get("/excel/jobs/abc")
    assert response.status_code == 200
    body = response.json()
    assert body["state"] == "queued"
    assert body["result"] is None


def test_job_state_running(auth_client, monkeypatch):
    _patch_async_result(monkeypatch, _StubResult("STARTED"))
    response = auth_client.get("/excel/jobs/abc")
    assert response.json()["state"] == "running"


def _minimal_result_payload() -> dict[str, Any]:
    return {
        "summary": {
            "total_ads": 1,
            "total_campaigns": 1,
            "avg_score": 70.0,
            "improved_count": 0,
            "campaigns": [{"name": "K", "groups": ["g"], "ads_count": 1}],
        },
        "ads": [
            {
                "original": {
                    "row": 2,
                    "campaign": "K",
                    "group": "g",
                    "headline": "h",
                    "headline2": None,
                    "text": "t",
                    "keywords": [],
                },
                "audit": {"score": 70, "issues": [], "suggestions": []},
                "improved": None,
            }
        ],
        "errors": [],
        "insights": {"weak_ads_percent": 0, "estimated_ctr_loss": "low"},
        "plan": "free",
        "limits": {
            "plan": "free",
            "uploads": 3,
            "ai_ads": 3,
            "max_ads_per_upload": 50,
            "watermark": True,
        },
        "usage": {"uploads_used": 1, "ai_ads_used": 0, "ai_ads_remaining": 3},
        "paywall": None,
        "campaign_analytics": [],
    }


def test_job_state_done_returns_result(auth_client, monkeypatch):
    _patch_async_result(
        monkeypatch, _StubResult("SUCCESS", result=_minimal_result_payload())
    )
    response = auth_client.get("/excel/jobs/abc")
    assert response.status_code == 200
    body = response.json()
    assert body["state"] == "done"
    assert body["result"]["summary"]["total_ads"] == 1
    assert body["result"]["plan"] == "free"


def test_job_state_failed_surfaces_error(auth_client, monkeypatch):
    _patch_async_result(
        monkeypatch, _StubResult("FAILURE", result=RuntimeError("worker died"))
    )
    response = auth_client.get("/excel/jobs/abc")
    assert response.status_code == 200
    body = response.json()
    assert body["state"] == "failed"
    assert "worker died" in body["error"]
