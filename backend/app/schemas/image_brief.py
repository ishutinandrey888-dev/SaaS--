from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ImageBriefCreate(BaseModel):
    project_id: uuid.UUID | None = None
    site_url: str | None = Field(default=None, max_length=1024)
    brand: dict = Field(default_factory=dict)
    brief: dict = Field(default_factory=dict)


class ImageBriefOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID | None
    site_url: str | None
    status: str
    brand: dict
    brief: dict
    generated_assets: list
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
