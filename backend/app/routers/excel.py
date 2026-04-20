"""Excel upload → parse → audit → AI improvement.

Product flow:
  1. User uploads a Yandex Direct XLSX.
  2. We parse all ads (errors collected, not raised).
  3. Every ad gets a heuristic audit (cheap, sync).
  4. The `IMPROVE_LIMIT` worst-scoring ads are sent to OpenAI in parallel
     for a rewrite.  AI failures degrade to "no improved version" — the
     rest of the response still returns.
  5. Aggregate insights (CTR-loss estimate, weak-ads %) are attached.

Nothing is persisted to Postgres here: the endpoint is a stateless
analyse-and-return.  An audit-log row is written so we can see who
uploaded what.
"""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, HTTPException, Request, UploadFile, status

from app.core.config import get_settings
from app.core.database import UserDB
from app.middleware.auth import CurrentUser
from app.middleware.rate_limit import limiter
from app.schemas.excel import (
    AdAudit,
    AdImproved,
    AdOriginal,
    AdResult,
    CampaignSummary,
    ExcelUploadResponse,
    Insights,
    ParseError,
    Summary,
)
from app.services import audit
from app.services.ai_ads import improve_ad
from app.services.audit_ads import analyze_ad
from app.services.excel_import import parse_direct_excel

router = APIRouter(prefix="/excel", tags=["excel"])
settings = get_settings()

_ACCEPTED_CONTENT_TYPES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/octet-stream",  # some browsers/clients
}
_ACCEPTED_EXTS = (".xlsx", ".xlsm")

IMPROVE_LIMIT = 5
WEAK_SCORE = 60


def _validate_upload(file: UploadFile) -> None:
    name = (file.filename or "").lower()
    if not name.endswith(_ACCEPTED_EXTS):
        raise HTTPException(status_code=400, detail="unsupported_file_type")
    if file.content_type and file.content_type not in _ACCEPTED_CONTENT_TYPES:
        # Don't hard-fail on content-type alone — extension is authoritative —
        # but reject clearly-wrong MIME types like text/html.
        if not file.content_type.startswith(
            ("application/", "binary/", "multipart/")
        ):
            raise HTTPException(status_code=400, detail="unsupported_file_type")


def _rank_for_improvement(ads_with_audit: list[tuple[dict, dict]]) -> list[int]:
    """Indices of ads to send to AI, worst-first, capped at IMPROVE_LIMIT."""
    order = sorted(
        range(len(ads_with_audit)),
        key=lambda i: ads_with_audit[i][1]["score"],
    )
    return order[:IMPROVE_LIMIT]


def _estimate_ctr_loss(avg_score: float, weak_pct: int) -> str:
    if avg_score >= 80 and weak_pct < 10:
        return "low"
    if avg_score >= 65:
        return "moderate (~10-20%)"
    if avg_score >= 50:
        return "high (~20-35%)"
    return "severe (>35%)"


def _build_insights(audits: list[dict[str, Any]]) -> Insights:
    if not audits:
        return Insights(weak_ads_percent=0, estimated_ctr_loss="n/a")
    weak = sum(1 for a in audits if a["score"] < WEAK_SCORE)
    weak_pct = int(round(weak * 100 / len(audits)))
    avg = sum(a["score"] for a in audits) / len(audits)
    return Insights(weak_ads_percent=weak_pct, estimated_ctr_loss=_estimate_ctr_loss(avg, weak_pct))


@router.post(
    "/upload",
    response_model=ExcelUploadResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("5/minute")
async def upload_excel(
    request: Request,
    file: UploadFile,
    user: CurrentUser,
    db: UserDB,  # opens an RLS-scoped session; reserved for follow-up saves
) -> ExcelUploadResponse:
    _ = db  # unused today, kept so future persistence doesn't re-plumb deps
    _validate_upload(file)

    parsed = await parse_direct_excel(file, max_bytes=settings.max_upload_size_bytes)
    ads_raw: list[dict[str, Any]] = parsed["ads"]
    errors_raw: list[dict[str, Any]] = parsed["errors"]
    campaigns_raw: list[dict[str, Any]] = parsed["campaigns"]

    # Early exit if nothing parseable — still a 200 with empty body so the
    # frontend can render the error list.
    if not ads_raw:
        await audit.log(
            action=audit.Action.EXCEL_UPLOAD,
            request=request,
            user=user,
            success=False,
            meta={
                "filename": file.filename,
                "ads": 0,
                "errors": len(errors_raw),
            },
        )
        return ExcelUploadResponse(
            summary=Summary(
                total_ads=0,
                total_campaigns=0,
                avg_score=0.0,
                improved_count=0,
                campaigns=[],
            ),
            ads=[],
            errors=[ParseError(**e) for e in errors_raw],
            insights=Insights(weak_ads_percent=0, estimated_ctr_loss="n/a"),
        )

    audits = [analyze_ad(ad) for ad in ads_raw]
    pairs = list(zip(ads_raw, audits))

    improve_idx = set(_rank_for_improvement(pairs))
    improvement_tasks = {
        idx: asyncio.create_task(improve_ad(ads_raw[idx])) for idx in improve_idx
    }
    improved_results: dict[int, dict[str, Any] | None] = {}
    if improvement_tasks:
        done = await asyncio.gather(*improvement_tasks.values(), return_exceptions=True)
        for idx, result in zip(improvement_tasks.keys(), done):
            if isinstance(result, Exception):
                improved_results[idx] = None
            else:
                improved_results[idx] = result

    ad_results: list[AdResult] = []
    for idx, (ad, aud) in enumerate(pairs):
        improved = improved_results.get(idx)
        ad_results.append(
            AdResult(
                original=AdOriginal(**ad),
                audit=AdAudit(**aud),
                improved=AdImproved(**improved) if improved else None,
            )
        )

    avg_score = sum(a["score"] for a in audits) / len(audits)
    summary = Summary(
        total_ads=len(ad_results),
        total_campaigns=len(campaigns_raw),
        avg_score=round(avg_score, 1),
        improved_count=sum(1 for r in ad_results if r.improved is not None),
        campaigns=[CampaignSummary(**c) for c in campaigns_raw],
    )
    insights = _build_insights(audits)

    await audit.log(
        action=audit.Action.EXCEL_UPLOAD,
        request=request,
        user=user,
        meta={
            "filename": file.filename,
            "ads": summary.total_ads,
            "campaigns": summary.total_campaigns,
            "avg_score": summary.avg_score,
            "improved": summary.improved_count,
            "errors": len(errors_raw),
        },
    )

    return ExcelUploadResponse(
        summary=summary,
        ads=ad_results,
        errors=[ParseError(**e) for e in errors_raw],
        insights=insights,
    )
