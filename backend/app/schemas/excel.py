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


class CampaignIssue(BaseModel):
    key: str
    label: str
    count: int


class CampaignAnalytics(BaseModel):
    name: str
    groups: list[str] = Field(default_factory=list)
    ads_count: int
    improved_count: int
    avg_score: float
    weak_ads_percent: int = Field(ge=0, le=100)
    top_issues: list[CampaignIssue] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    tone: str  # "good" | "warn" | "bad"


class Summary(BaseModel):
    total_ads: int
    total_campaigns: int
    avg_score: float
    improved_count: int
    campaigns: list[CampaignSummary] = Field(default_factory=list)


class Insights(BaseModel):
    weak_ads_percent: int = Field(ge=0, le=100)
    estimated_ctr_loss: str


class Limits(BaseModel):
    plan: str
    uploads: int | None
    ai_ads: int | None
    max_ads_per_upload: int
    watermark: bool = False


class Usage(BaseModel):
    uploads_used: int
    ai_ads_used: int
    ai_ads_remaining: int | None


class Paywall(BaseModel):
    trigger: str
    message: str
    cta: str
    upgrade_hint: str | None = None


class ExcelUploadResponse(BaseModel):
    summary: Summary
    ads: list[AdResult]
    errors: list[ParseError] = Field(default_factory=list)
    insights: Insights
    plan: str = "free"
    limits: Limits
    usage: Usage
    paywall: Paywall | None = None
    campaign_analytics: list[CampaignAnalytics] = Field(default_factory=list)


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


class ImproveAllRequest(BaseModel):
    ads: list[AdOriginal] = Field(min_length=1, max_length=500)


class ImprovedAd(BaseModel):
    row: int
    improved: AdImproved


class ImproveAllResponse(BaseModel):
    improved: list[ImprovedAd] = Field(default_factory=list)
    improved_count: int
    requested_count: int
    plan: str
    limits: Limits
    usage: Usage
    paywall: Paywall | None = None
