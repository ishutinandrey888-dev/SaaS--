from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import select

from app.core.database import UserDB
from app.middleware.auth import CurrentUser
from app.models.image_brief import ImageBrief
from app.schemas.image_brief import ImageBriefCreate, ImageBriefOut

router = APIRouter(prefix="/image-briefs", tags=["image-briefs"])


@router.get("", response_model=list[ImageBriefOut])
async def list_image_briefs(user: CurrentUser, db: UserDB) -> list[ImageBriefOut]:
    rows = (
        await db.execute(
            select(ImageBrief)
            .where(ImageBrief.user_id == user.id)
            .order_by(ImageBrief.created_at.desc())
        )
    ).scalars().all()
    return [ImageBriefOut.model_validate(r) for r in rows]


@router.post("", response_model=ImageBriefOut, status_code=201)
async def create_image_brief(
    payload: ImageBriefCreate, user: CurrentUser, db: UserDB
) -> ImageBriefOut:
    row = ImageBrief(user_id=user.id, **payload.model_dump())
    db.add(row)
    await db.flush()
    return ImageBriefOut.model_validate(row)
