"""Celery task: run the Excel upload pipeline off the request thread.

The HTTP handler reads the uploaded file into bytes, validates the
MIME/extension, looks up the user's plan + lifetime AI spend, then
hands everything off to `process_upload_task.delay(...)`.  The task
runs the same pipeline the sync endpoint uses, but against an admin
(BYPASSRLS) session — RLS is moot here because every billing query
filters by `:uid` explicitly.

State model (Celery-native):
  * PENDING  — task not yet picked up
  * STARTED  — worker has the task (task_track_started = True)
  * SUCCESS  — result is a dict-serialised ExcelUploadResponse
  * FAILURE  — worker raised; we surface `error` from info

The router exposes that via GET /excel/jobs/{id}; the frontend polls.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any

from app.core.database import AsyncSessionAdmin, engine_admin
from app.services.excel_pipeline import run_upload_pipeline
from app.tasks.celery_app import celery_app

logger = logging.getLogger("excel_jobs")


async def _run(
    *,
    user_id: uuid.UUID,
    plan_id: str,
    lifetime_ai_ads: int,
    file_bytes: bytes,
    filename: str,
) -> dict[str, Any]:
    """Open an admin session, run the pipeline, return a JSON-safe dict.

    Always `await engine_admin.dispose()` at the end — each task runs
    under a fresh `asyncio.run()` event loop, and SQLAlchemy async pools
    can't be shared across loops.  Disposing guarantees the next task
    opens new connections instead of resurrecting ones bound to a dead
    loop.
    """
    try:
        async with AsyncSessionAdmin() as session:
            session.info["kind"] = "admin"
            try:
                response = await run_upload_pipeline(
                    db=session,
                    user_id=user_id,
                    plan_id=plan_id,
                    lifetime_ai_ads=lifetime_ai_ads,
                    file_bytes=file_bytes,
                    filename=filename,
                    audit_request=None,
                    audit_user=user_id,
                )
                await session.commit()
            except Exception:
                await session.rollback()
                raise
        return response.model_dump(mode="json")
    finally:
        await engine_admin.dispose()


@celery_app.task(
    bind=True,
    name="excel.process_upload",
    autoretry_for=(),  # intentional: parse/AI errors are user-visible, not retryable
    acks_late=True,
)
def process_upload_task(
    self,  # noqa: ARG001 — bound for future telemetry hooks
    *,
    user_id: str,
    plan_id: str,
    lifetime_ai_ads: int,
    file_bytes: bytes,
    filename: str,
) -> dict[str, Any]:
    uid = uuid.UUID(user_id)
    return asyncio.run(
        _run(
            user_id=uid,
            plan_id=plan_id,
            lifetime_ai_ads=lifetime_ai_ads,
            file_bytes=file_bytes,
            filename=filename,
        )
    )
