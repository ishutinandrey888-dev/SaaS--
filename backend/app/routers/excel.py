"""Excel upload → parse → audit → AI improvement.

Product flow:
  1. User uploads a Yandex Direct XLSX.
  2. We gate on tier: if the monthly upload quota is exhausted we return
     a paywall-only response (no ads), no AI spend.
  3. Parse all ads (errors collected, not raised).  Trim to the
     per-upload ads cap — surplus is surfaced as a paywall hint, not
     dropped silently.
  4. Every kept ad gets a heuristic audit (cheap, sync).
  5. We cap AI improvement by the remaining tier quota and improve the
     worst-scoring ads within that cap.  AI failures degrade to
     "no improved version" — the rest of the response still returns.
  6. Aggregate insights (CTR-loss estimate, weak-ads %) are attached.
  7. Counters + upload history are committed in the user-scoped
     transaction; audit log is written out-of-band.

Partial execution, not hard failure: when a limit bites we still
return whatever we were allowed to produce.  The `paywall` field tells
the frontend which upsell surface to show.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request, Response, UploadFile, status
from sqlalchemy import text

from app.core.config import get_settings
from app.core.database import UserDB
from app.middleware.auth import CurrentUser
from app.middleware.rate_limit import limiter
from app.schemas.excel import (
    AdAudit,
    AdImproved,
    AdOriginal,
    AdResult,
    CampaignAnalytics,
    CampaignIssue,
    CampaignSummary,
    ExcelUploadResponse,
    ExportRequest,
    Insights,
    Limits,
    ParseError,
    Paywall,
    Summary,
    Usage,
)
from app.services import audit, billing
from app.services.ai_ads import improve_ad
from app.services.audit_ads import analyze_ad
from app.services.campaign_analytics import analyze_campaigns
from app.services.excel_export import build_direct_xlsx, slugify_filename
from app.services.excel_import import parse_direct_excel

router = APIRouter(prefix="/excel", tags=["excel"])
settings = get_settings()
logger = logging.getLogger("excel")

_ACCEPTED_CONTENT_TYPES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/octet-stream",  # some browsers/clients
}
_ACCEPTED_EXTS = (".xlsx", ".xlsm")

# We cap any single AI batch here so a 2000-ad Pro upload doesn't fan
# out to 2000 OpenAI calls.  Remaining ads come back un-improved with
# an "on_improve_all" paywall hint nudging the user.
AI_BATCH_CAP = 50
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


def _rank_worst_first(audits: list[dict[str, Any]], cap: int) -> list[int]:
    """Indices of ads to send to AI, worst-score first, capped at cap."""
    if cap <= 0:
        return []
    order = sorted(range(len(audits)), key=lambda i: audits[i]["score"])
    return order[:cap]


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
    return Insights(
        weak_ads_percent=weak_pct,
        estimated_ctr_loss=_estimate_ctr_loss(avg, weak_pct),
    )


def _snapshot_to_limits(plan_id: str) -> Limits:
    plan = billing.get_plan(plan_id)
    return Limits(
        plan=plan.id,
        uploads=plan.uploads_per_month,
        ai_ads=plan.ai_ads_per_period,
        max_ads_per_upload=plan.max_ads_per_upload,
        watermark=plan.watermark,
    )


def _snapshot_to_usage(u: billing.UsageSnapshot) -> Usage:
    return Usage(
        uploads_used=u.uploads_used,
        ai_ads_used=u.ai_ads_used,
        ai_ads_remaining=u.ai_ads_remaining,
    )


def _maybe_paywall_to_schema(
    pw: billing.Paywall | None,
) -> Paywall | None:
    if pw is None:
        return None
    return Paywall(
        trigger=pw.trigger,
        message=pw.message,
        cta=pw.cta,
        upgrade_hint=pw.upgrade_hint,
    )


_INSERT_UPLOAD_HISTORY = text(
    """
    INSERT INTO upload_history
      (user_id, filename, total_ads, total_campaigns,
       improved_count, weak_ads_percent, avg_score)
    VALUES
      (:uid, :filename, :total_ads, :total_campaigns,
       :improved, :weak_pct, :avg_score)
    """
)


async def _record_upload(
    db, user_id, *, filename: str, summary: Summary, weak_pct: int
) -> None:
    try:
        await db.execute(
            _INSERT_UPLOAD_HISTORY,
            {
                "uid": str(user_id),
                "filename": (filename or "upload.xlsx")[:512],
                "total_ads": summary.total_ads,
                "total_campaigns": summary.total_campaigns,
                "improved": summary.improved_count,
                "weak_pct": weak_pct,
                "avg_score": float(summary.avg_score),
            },
        )
    except Exception:  # noqa: BLE001 — history is best-effort
        logger.warning("upload_history_failed user=%s", user_id, exc_info=True)


def _paywall_only_response(
    summary: Summary,
    errors: list[dict[str, Any]],
    plan_id: str,
    usage: billing.UsageSnapshot,
    pw: billing.Paywall | None,
) -> ExcelUploadResponse:
    return ExcelUploadResponse(
        summary=summary,
        ads=[],
        errors=[ParseError(**e) for e in errors],
        insights=Insights(weak_ads_percent=0, estimated_ctr_loss="n/a"),
        plan=plan_id,
        limits=_snapshot_to_limits(plan_id),
        usage=_snapshot_to_usage(usage),
        paywall=_maybe_paywall_to_schema(pw),
        campaign_analytics=[],
    )


def _campaigns_to_schema(
    raw: list[dict[str, Any]],
) -> list[CampaignAnalytics]:
    return [
        CampaignAnalytics(
            name=c["name"],
            groups=c["groups"],
            ads_count=c["ads_count"],
            improved_count=c["improved_count"],
            avg_score=c["avg_score"],
            weak_ads_percent=c["weak_ads_percent"],
            top_issues=[CampaignIssue(**i) for i in c["top_issues"]],
            recommendations=c["recommendations"],
            tone=c["tone"],
        )
        for c in raw
    ]


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
    db: UserDB,
) -> ExcelUploadResponse:
    _validate_upload(file)

    plan_id = getattr(user, "plan", "free") or "free"
    lifetime = int(getattr(user, "ai_ads_used_lifetime", 0) or 0)
    usage = await billing.get_usage(db, user.id, plan_id, lifetime)

    empty_summary = Summary(
        total_ads=0,
        total_campaigns=0,
        avg_score=0.0,
        improved_count=0,
        campaigns=[],
    )

    # --- Gate 1: monthly upload quota ---------------------------------
    if usage.uploads_exhausted:
        pw = billing.build_paywall("on_upload_exhausted", plan=usage.plan)
        await audit.log(
            action=audit.Action.EXCEL_UPLOAD,
            request=request,
            user=user,
            success=False,
            meta={"filename": file.filename, "reason": "upload_limit"},
        )
        return _paywall_only_response(empty_summary, [], plan_id, usage, pw)

    # --- Parse --------------------------------------------------------
    parsed = await parse_direct_excel(
        file, max_bytes=settings.max_upload_size_bytes
    )
    ads_raw: list[dict[str, Any]] = parsed["ads"]
    errors_raw: list[dict[str, Any]] = parsed["errors"]
    campaigns_raw: list[dict[str, Any]] = parsed["campaigns"]

    if not ads_raw:
        await billing.consume_usage(
            db, user.id, uploads=1, plan_id=plan_id
        )
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
        # Re-read usage so the response reflects the just-spent upload.
        usage_after = await billing.get_usage(db, user.id, plan_id, lifetime)
        return _paywall_only_response(
            empty_summary, errors_raw, plan_id, usage_after, None
        )

    # --- Gate 2: per-upload ads cap (silent trim) ---------------------
    total_parsed = len(ads_raw)
    kept, trimmed = billing.cap_ads_per_upload(total_parsed, plan_id)
    ads_kept = ads_raw[:kept]
    dropped_count = total_parsed - kept

    # --- Audit (always free) ------------------------------------------
    audits = [analyze_ad(ad) for ad in ads_kept]

    # --- Gate 3: AI budget (partial) ----------------------------------
    desired_ai = min(len(ads_kept), AI_BATCH_CAP)
    ai_allowed, ai_capped = billing.cap_ai_budget(desired_ai, usage)
    improve_idx = set(_rank_worst_first(audits, ai_allowed))

    improvement_tasks = {
        idx: asyncio.create_task(improve_ad(ads_kept[idx])) for idx in improve_idx
    }
    improved_results: dict[int, dict[str, Any] | None] = {}
    if improvement_tasks:
        done = await asyncio.gather(
            *improvement_tasks.values(), return_exceptions=True
        )
        for idx, result in zip(improvement_tasks.keys(), done):
            if isinstance(result, Exception):
                improved_results[idx] = None
            else:
                improved_results[idx] = result

    ad_results: list[AdResult] = []
    for idx, (ad, aud) in enumerate(zip(ads_kept, audits)):
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
    improved_flags = [r.improved is not None for r in ad_results]
    campaign_analytics = _campaigns_to_schema(
        analyze_campaigns(ads_kept, audits, improved_flags=improved_flags)
    )

    # --- Write meters + history --------------------------------------
    await billing.consume_usage(
        db,
        user.id,
        uploads=1,
        ai_ads=summary.improved_count,
        ai_requests=1 if improvement_tasks else 0,
        plan_id=plan_id,
    )
    await _record_upload(
        db,
        user.id,
        filename=file.filename or "upload.xlsx",
        summary=summary,
        weak_pct=insights.weak_ads_percent,
    )

    # Refresh snapshot so response mirrors post-consume state.
    usage_after = await billing.get_usage(
        db, user.id, plan_id, lifetime + summary.improved_count
    )

    # --- Pick paywall trigger ----------------------------------------
    pw_trigger: billing.PaywallTrigger | None = None
    unimproved_left = 0
    if dropped_count > 0:
        pw_trigger = "on_ads_per_upload"
    elif ai_capped:
        pw_trigger = "on_improve_all"
        unimproved_left = len(ads_kept) - summary.improved_count
    elif usage_after.ai_ads_remaining == 0 and usage.plan != "pro":
        pw_trigger = "after_analysis"

    paywall = billing.build_paywall(
        pw_trigger,
        plan=usage.plan,
        unimproved_left=max(unimproved_left, dropped_count),
    ) if pw_trigger else None

    await audit.log(
        action=audit.Action.EXCEL_UPLOAD,
        request=request,
        user=user,
        meta={
            "filename": file.filename,
            "ads": summary.total_ads,
            "dropped": dropped_count,
            "campaigns": summary.total_campaigns,
            "avg_score": summary.avg_score,
            "improved": summary.improved_count,
            "errors": len(errors_raw),
            "plan": plan_id,
        },
    )

    return ExcelUploadResponse(
        summary=summary,
        ads=ad_results,
        errors=[ParseError(**e) for e in errors_raw],
        insights=insights,
        plan=plan_id,
        limits=_snapshot_to_limits(plan_id),
        usage=_snapshot_to_usage(usage_after),
        paywall=_maybe_paywall_to_schema(paywall),
        campaign_analytics=campaign_analytics,
    )


_XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.post(
    "/export",
    status_code=status.HTTP_200_OK,
    responses={200: {"content": {_XLSX_MIME: {}}}},
)
@limiter.limit("20/minute")
async def export_excel(
    request: Request,
    payload: ExportRequest,
    user: CurrentUser,
    db: UserDB,
) -> Response:
    """Build a Yandex Direct-shaped XLSX from the given ads and return it."""
    _ = db  # export is unmetered per product contract

    ads = [ad.model_dump() for ad in payload.ads]
    data = build_direct_xlsx(ads)

    name = slugify_filename(payload.filename)
    headers = {"Content-Disposition": f'attachment; filename="{name}.xlsx"'}

    await audit.log(
        action=audit.Action.EXPORT_XLSX,
        request=request,
        user=user,
        meta={"filename": name, "ads": len(ads)},
    )

    return Response(content=data, media_type=_XLSX_MIME, headers=headers)
