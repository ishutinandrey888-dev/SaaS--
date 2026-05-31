from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class CompetitorAnalyzeRequest(BaseModel):
    query: str = Field(min_length=2, max_length=255)
    region: str = Field(default="Москва", max_length=120)
    source: str = Field(default="yandex_direct", max_length=32)


class CompetitorReportOut(BaseModel):
    id: uuid.UUID
    query: str
    region: str
    source: str
    results: dict
    created_at: datetime

    model_config = {"from_attributes": True}


class CompetitorWatchCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    domain: str = Field(min_length=3, max_length=255)
    query: str = Field(min_length=2, max_length=255)
    notes: str | None = None
    last_snapshot: dict = Field(default_factory=dict)


class CompetitorWatchOut(BaseModel):
    id: uuid.UUID
    name: str
    domain: str
    query: str
    notes: str | None
    active: bool
    last_snapshot: dict
    created_at: datetime

    model_config = {"from_attributes": True}
