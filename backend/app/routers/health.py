from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db

router = APIRouter(tags=["health"])
settings = get_settings()


class Health(BaseModel):
    status: str
    env: str
    db: str
    version: str = "0.1.0"


@router.get("/health", response_model=Health, status_code=status.HTTP_200_OK)
async def health(db: AsyncSession = Depends(get_db)) -> Health:
    db_state = "ok"
    try:
        await asyncio.wait_for(db.execute(text("SELECT 1")), timeout=2.0)
    except Exception:  # noqa: BLE001 -- intentional broad catch for healthcheck
        db_state = "unreachable"
    return Health(status="ok", env=settings.env, db=db_state)


@router.get("/ready", status_code=status.HTTP_200_OK)
async def ready() -> dict[str, str]:
    return {"status": "ready"}
