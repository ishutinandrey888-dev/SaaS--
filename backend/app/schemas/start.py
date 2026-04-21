from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.excel import Limits, Paywall, Usage


class StartBrief(BaseModel):
    product: str = Field(min_length=2, max_length=200)
    audience: str = Field(min_length=2, max_length=300)
    region: str = Field(min_length=2, max_length=100)
    keywords: list[str] = Field(default_factory=list, max_length=20)
    tone: str = Field(default="neutral", max_length=32)
    count: int = Field(default=5, ge=1, le=10)


class StartGeneratedAd(BaseModel):
    headline: str
    headline2: str | None = None
    text: str
    keywords: list[str] = Field(default_factory=list)
    reasoning: str = ""


class StartGenerateResponse(BaseModel):
    ads: list[StartGeneratedAd]
    requested_count: int
    generated_count: int
    plan: str
    limits: Limits
    usage: Usage
    paywall: Paywall | None = None
