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

Two entry points:
  * `POST /excel/upload` — synchronous; completes the whole pipeline
    before returning.  Kept for small files + programmatic use.
  * `POST /excel/jobs` + `GET /excel/jobs/{id}` — async; enqueues the
    job on Celery and the client polls for the result.  This is the
    preferred path for the web UI.

Partial execution, not hard failure: when a limit bites we still
return whatever we were allowed to produce.  The `paywall` field tells
the frontend which upsell surface to show.
"""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, HTTPException, Request, Response, UploadFile, status

from app.core.config import get_settings
from app.core.database import UserDB
from app.middleware.auth import CurrentUser
from app.middleware.rate_limit import limiter
from app.schemas.excel import (
    AdImproved,
    ExcelUploadResponse,
    ExportRequest,
    ImproveAllRequest,
    ImproveAllResponse,
    ImprovedAd,
    JobCreatedResponse,
    JobStateResponse,
)
from app.services import ai_ads, audit, billing
from app.services.audit_ads import analyze_ad
from app.services.excel_export import build_direct_xlsx, slugify_filename
from app.services.excel_pipeline import (
    AI_BATCH_CAP,
    _maybe_paywall_to_schema,
    _rank_worst_first,
    _snapshot_to_limits,
    _snapshot_to_usage,
    run_upload_pipeline,
)

router = APIRouter(prefix="/excel", tags=["excel"])
settings = get_settings()
logger = logging.getLogger("excel")

_ACCEPTED_CONTENT_TYPES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/octet-stream",  # some browsers/clients
}
_ACCEPTED_EXTS = (".xlsx", ".xlsm")


def _validate_upload(file: UploadFile) -> None:
    name = (file.filename or "").lower()
    if not name.endswith(_ACCEPTED_EXTS):
        raise HTTPException(status_code=400, detail="unsupported_file_type")
    if file.content_type and file.content_type not in _ACCEPTED_CONTENT_TYPES:
        if not file.content_type.startswith(
            ("application/", "binary/", "multipart/")
        ):
            raise HTTPException(status_code=400, detail="unsupported_file_type")


async def _read_upload_bytes(file: UploadFile, max_bytes: int) -> bytes:
    """Drain the upload body, capping at max_bytes + 1 so the pipeline
    can surface a clean 'file_too_large' error rather than OOM."""
    chunks: list[bytes] = []
    total = 0
    cap = max_bytes + 1
    while True:
        chunk = await file.read(64 * 1024)
        if not chunk:
            break
        total += len(chunk)
        chunks.append(chunk)
        if total > cap:
            break
    return b"".join(chunks)


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
    data = await _read_upload_bytes(file, settings.max_upload_size_bytes)

    plan_id = getattr(user, "plan", "free") or "free"
    lifetime = int(getattr(user, "ai_ads_used_lifetime", 0) or 0)

    return await run_upload_pipeline(
        db=db,
        user_id=user.id,
        plan_id=plan_id,
        lifetime_ai_ads=lifetime,
        file_bytes=data,
        filename=file.filename or "upload.xlsx",
        audit_request=request,
        audit_user=user,
    )


@router.post(
    "/jobs",
    response_model=JobCreatedResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
@limiter.limit("5/minute")
async def create_excel_job(
    request: Request,
    file: UploadFile,
    user: CurrentUser,
    db: UserDB,
) -> JobCreatedResponse:
    """Accept the file synchronously, enqueue the heavy work on Celery.

    Returns a `job_id` the client polls via GET /excel/jobs/{job_id}.
    """
    _ = db  # only used by the dependency; the worker opens its own session
    _validate_upload(file)
    data = await _read_upload_bytes(file, settings.max_upload_size_bytes)

    plan_id = getattr(user, "plan", "free") or "free"
    lifetime = int(getattr(user, "ai_ads_used_lifetime", 0) or 0)

    from app.tasks.excel_jobs import process_upload_task

    async_result = process_upload_task.delay(
        user_id=str(user.id),
        plan_id=plan_id,
        lifetime_ai_ads=lifetime,
        file_bytes=data,
        filename=file.filename or "upload.xlsx",
    )
    logger.info(
        "excel_job_enqueued user=%s job=%s bytes=%d",
        user.id,
        async_result.id,
        len(data),
    )
    return JobCreatedResponse(job_id=async_result.id, state="queued")


_CELERY_TO_PUBLIC = {
    "PENDING": "queued",
    "RECEIVED": "queued",
    "STARTED": "running",
    "RETRY": "running",
    "SUCCESS": "done",
    "FAILURE": "failed",
    "REVOKED": "failed",
}


@router.get(
    "/jobs/{job_id}",
    response_model=JobStateResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("60/minute")
async def get_excel_job(
    request: Request,
    job_id: str,
    user: CurrentUser,
    db: UserDB,
) -> JobStateResponse:
    _ = db
    _ = user  # presence enforced by dependency; we don't tie jobs to user in MVP
    from app.tasks.celery_app import celery_app
    from celery.result import AsyncResult

    result = AsyncResult(job_id, app=celery_app)
    state = _CELERY_TO_PUBLIC.get(result.state, "queued")

    if state == "done":
        payload = result.result
        return JobStateResponse(
            job_id=job_id,
            state="done",
            result=ExcelUploadResponse.model_validate(payload),
        )
    if state == "failed":
        info = result.result
        message = str(info) if info else "job_failed"
        return JobStateResponse(job_id=job_id, state="failed", error=message)
    return JobStateResponse(job_id=job_id, state=state)


@router.post(
    "/improve-all",
    response_model=ImproveAllResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("3/minute")
async def improve_all(
    request: Request,
    payload: ImproveAllRequest,
    user: CurrentUser,
    db: UserDB,
) -> ImproveAllResponse:
    """Batch-improve a caller-supplied set of ads, subject to AI budget.

    Client sends the ads it still wants improved (typically: everything
    that didn't get an `improved` version on initial upload).  We
    re-audit cheaply, take the worst-scoring ones up to the remaining
    AI budget (and the hard batch cap), and return the rewrites.  The
    caller merges them back by `row`.
    """
    plan_id = getattr(user, "plan", "free") or "free"
    lifetime = int(getattr(user, "ai_ads_used_lifetime", 0) or 0)
    usage = await billing.get_usage(db, user.id, plan_id, lifetime)

    requested = len(payload.ads)
    desired = min(requested, AI_BATCH_CAP)
    ai_allowed, ai_capped = billing.cap_ai_budget(desired, usage)

    improved_items: list[ImprovedAd] = []
    if ai_allowed > 0:
        ads_raw = [ad.model_dump() for ad in payload.ads]
        audits = [analyze_ad(ad) for ad in ads_raw]
        order = _rank_worst_first(audits, ai_allowed)

        tasks = {
            idx: asyncio.create_task(ai_ads.improve_ad(ads_raw[idx]))
            for idx in order
        }
        done = await asyncio.gather(*tasks.values(), return_exceptions=True)
        for idx, result in zip(tasks.keys(), done):
            if isinstance(result, Exception) or result is None:
                continue
            improved_items.append(
                ImprovedAd(
                    row=int(ads_raw[idx]["row"]),
                    improved=AdImproved(**result),
                )
            )

    improved_count = len(improved_items)

    if improved_count > 0:
        await billing.consume_usage(
            db,
            user.id,
            ai_ads=improved_count,
            ai_requests=1,
            plan_id=plan_id,
        )

    usage_after = await billing.get_usage(
        db, user.id, plan_id, lifetime + improved_count
    )

    pw_trigger: billing.PaywallTrigger | None = None
    unimproved_left = requested - improved_count
    if ai_capped or requested > AI_BATCH_CAP:
        pw_trigger = "on_improve_all"
    elif (
        usage_after.ai_ads_remaining == 0
        and usage.plan != "pro"
        and requested > 0
    ):
        pw_trigger = "after_analysis"

    paywall = billing.build_paywall(
        pw_trigger, plan=usage.plan, unimproved_left=unimproved_left
    ) if pw_trigger else None

    await audit.log(
        action=audit.Action.EXCEL_IMPROVE_ALL,
        request=request,
        user=user,
        meta={
            "requested": requested,
            "improved": improved_count,
            "plan": plan_id,
        },
    )

    return ImproveAllResponse(
        improved=improved_items,
        improved_count=improved_count,
        requested_count=requested,
        plan=plan_id,
        limits=_snapshot_to_limits(plan_id),
        usage=_snapshot_to_usage(usage_after),
        paywall=_maybe_paywall_to_schema(paywall),
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
