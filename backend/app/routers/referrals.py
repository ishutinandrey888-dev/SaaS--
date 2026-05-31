from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.database import UserDB
from app.middleware.auth import CurrentUser
from app.models.referral import Referral, ReferralCode
from app.schemas.referral import ReferralOut, ReferralProgramResponse

router = APIRouter(prefix="/referrals", tags=["referrals"])


def _make_code(user_id) -> str:
    return "dp-" + str(user_id).replace("-", "")[:10]


@router.get("/program", response_model=ReferralProgramResponse)
async def program(user: CurrentUser, db: UserDB) -> ReferralProgramResponse:
    code = (
        await db.execute(select(ReferralCode).where(ReferralCode.user_id == user.id))
    ).scalar_one_or_none()
    if code is None:
        code = ReferralCode(user_id=user.id, code=_make_code(user.id))
        db.add(code)
        await db.flush()

    stats = (
        await db.execute(
            select(
                func.count(Referral.id),
                func.count(Referral.id).filter(Referral.status.in_(("activated", "paid"))),
                func.coalesce(func.sum(Referral.reward_tokens).filter(Referral.rewarded_at.isnot(None)), 0),
                func.coalesce(func.sum(Referral.reward_tokens).filter(Referral.rewarded_at.is_(None)), 0),
            ).where(Referral.referrer_id == user.id)
        )
    ).one()

    settings = get_settings()
    base_url = settings.cors_origin_list[0] if settings.cors_origin_list else "https://dozim.ai"
    return ReferralProgramResponse(
        code=code.code,
        invite_url=f"{base_url.rstrip('/')}/register?ref={code.code}",
        invited=int(stats[0] or 0),
        activated=int(stats[1] or 0),
        earned_tokens=int(stats[2] or 0),
        pending_tokens=int(stats[3] or 0),
    )


@router.get("", response_model=list[ReferralOut])
async def list_referrals(user: CurrentUser, db: UserDB) -> list[ReferralOut]:
    rows = (
        await db.execute(
            select(Referral).where(Referral.referrer_id == user.id).order_by(Referral.created_at.desc())
        )
    ).scalars().all()
    return [ReferralOut.model_validate(r) for r in rows]
