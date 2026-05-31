from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel


class ReferralProgramResponse(BaseModel):
    code: str
    invite_url: str
    invited: int
    activated: int
    earned_tokens: int
    pending_tokens: int


class ReferralOut(BaseModel):
    id: uuid.UUID
    code: str
    status: str
    reward_tokens: int
    created_at: datetime

    model_config = {"from_attributes": True}
