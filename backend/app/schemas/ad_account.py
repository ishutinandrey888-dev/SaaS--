from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AdAccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    provider: str
    external_id: str
    status: str
    expires_at: datetime | None
    created_at: datetime


class OAuthStartResponse(BaseModel):
    url: str
    stub: bool
