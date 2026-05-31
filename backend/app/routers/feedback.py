from __future__ import annotations

from fastapi import APIRouter, status

from app.core.database import AdminDB
from app.middleware.auth import CurrentUser
from app.models.admin_ops import FeedbackItem
from app.schemas.admin import FeedbackCreate, FeedbackOut

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("", response_model=FeedbackOut, status_code=status.HTTP_201_CREATED)
async def submit_feedback(
    payload: FeedbackCreate,
    user: CurrentUser,
    db: AdminDB,
) -> FeedbackOut:
    """Collect an in-app review, idea, or bug report from an authenticated user."""
    item = FeedbackItem(
        user_id=user.id,
        kind=payload.kind,
        rating=payload.rating,
        status="new",
        title=payload.title,
        body=payload.body,
        source=payload.source,
        meta=payload.meta,
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return FeedbackOut(
        id=item.id,
        user_id=item.user_id,
        kind=item.kind,
        rating=item.rating,
        status=item.status,
        title=item.title,
        body=item.body,
        source=item.source,
        meta=item.meta,
        created_at=item.created_at,
    )
