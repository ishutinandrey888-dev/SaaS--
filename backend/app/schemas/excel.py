from __future__ import annotations

from pydantic import BaseModel, Field


class AdOriginal(BaseModel):
    row: int
    campaign: str = ""
    group: str = ""
    headline: str = ""
    headline2: str | None = None
    text: str = ""
    keywords: list[str] = Field(default_factory=list)


class AdAudit(BaseModel):
    score: int = Field(ge=0, le=100)
    issues: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)


class AdImproved(BaseModel):
    headline: str
    text: str
    reasoning: str = ""


class AdResult(BaseModel):
    original: AdOriginal
    audit: AdAudit
    improved: AdImproved | None = None


class ParseError(BaseModel):
    row: int
    field: str
    message: str


class CampaignSummary(BaseModel):
    name: str
    groups: list[str] = Field(default_factory=list)
    ads_count: int


class Summary(BaseModel):
    total_ads: int
    total_campaigns: int
    avg_score: float
    improved_count: int
    campaigns: list[CampaignSummary] = Field(default_factory=list)


class Insights(BaseModel):
    weak_ads_percent: int = Field(ge=0, le=100)
    estimated_ctr_loss: str


class ExcelUploadResponse(BaseModel):
    summary: Summary
    ads: list[AdResult]
    errors: list[ParseError] = Field(default_factory=list)
    insights: Insights


class AdForExport(BaseModel):
    campaign: str = ""
    group: str = ""
    headline: str = Field(min_length=1)
    headline2: str | None = None
    text: str = Field(min_length=1)
    keywords: list[str] = Field(default_factory=list)


class ExportRequest(BaseModel):
    ads: list[AdForExport] = Field(min_length=1, max_length=5000)
    filename: str | None = None
