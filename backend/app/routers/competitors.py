from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.core.database import UserDB
from app.middleware.auth import CurrentUser
from app.models.competitor import CompetitorReport, CompetitorWatch
from app.schemas.competitor import (
    CompetitorAnalyzeRequest,
    CompetitorReportOut,
    CompetitorWatchCreate,
    CompetitorWatchOut,
)

router = APIRouter(prefix="/competitors", tags=["competitors"])


def _stub_results(query: str) -> dict:
    return {
        "query": query,
        "ads": [
            {
                "name": "ПотолкиПроф",
                "domain": "potolki-prof.ru",
                "title": "Натяжные потолки от 390 ₽/м²",
                "offer": "Замер бесплатно сегодня",
                "weaknesses": ["нет локального оффера"],
                "landing_score": 82,
            },
            {
                "name": "SkyCeilings",
                "domain": "skyceilings.ru",
                "title": "Современные потолки под ключ",
                "offer": "Акция до конца недели",
                "weaknesses": ["нет цены", "нет гарантии", "размытая акция"],
                "landing_score": 64,
            },
        ],
        "wordstat": [
            {"key": query, "frequency": 18400},
            {"key": "натяжные потолки цена", "frequency": 12900},
            {"key": "натяжные потолки под ключ", "frequency": 8700},
        ],
        "ai_rewrite": (
            "Отстройтесь конкретикой: цена от 390 ₽/м², монтаж за 1 день, "
            "гарантия 15 лет, расчёт сметы за 2 минуты."
        ),
    }


@router.post("/analyze", response_model=CompetitorReportOut, status_code=201)
async def analyze(
    payload: CompetitorAnalyzeRequest, user: CurrentUser, db: UserDB
) -> CompetitorReportOut:
    report = CompetitorReport(
        user_id=user.id,
        query=payload.query.strip(),
        region=payload.region.strip(),
        source=payload.source,
        results=_stub_results(payload.query.strip()),
    )
    db.add(report)
    await db.flush()
    return CompetitorReportOut.model_validate(report)


@router.get("/watch", response_model=list[CompetitorWatchOut])
async def list_watch(user: CurrentUser, db: UserDB) -> list[CompetitorWatchOut]:
    rows = (
        await db.execute(
            select(CompetitorWatch)
            .where(
                CompetitorWatch.user_id == user.id,
                CompetitorWatch.active.is_(True),
            )
            .order_by(CompetitorWatch.created_at.desc())
        )
    ).scalars().all()
    return [CompetitorWatchOut.model_validate(r) for r in rows]


@router.post("/watch", response_model=CompetitorWatchOut, status_code=201)
async def create_watch(
    payload: CompetitorWatchCreate, user: CurrentUser, db: UserDB
) -> CompetitorWatchOut:
    row = CompetitorWatch(user_id=user.id, **payload.model_dump())
    db.add(row)
    await db.flush()
    return CompetitorWatchOut.model_validate(row)


@router.delete("/watch/{watch_id}", status_code=204)
async def archive_watch(watch_id: uuid.UUID, user: CurrentUser, db: UserDB):
    row = (
        await db.execute(
            select(CompetitorWatch).where(
                CompetitorWatch.id == watch_id,
                CompetitorWatch.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="watch_not_found")
    row.active = False
