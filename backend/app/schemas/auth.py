from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.middleware.sanitize import SanitizedStr

_PASSWORD_MIN = 8
_PASSWORD_MAX = 128
_PWD_LETTER_RE = re.compile(r"[A-Za-zА-Яа-яЁё]")
_PWD_DIGIT_RE = re.compile(r"\d")


def _validate_password(value: str) -> str:
    if len(value) < _PASSWORD_MIN:
        raise ValueError(f"password too short (min {_PASSWORD_MIN})")
    if len(value) > _PASSWORD_MAX:
        raise ValueError(f"password too long (max {_PASSWORD_MAX})")
    if not _PWD_LETTER_RE.search(value):
        raise ValueError("password must contain a letter")
    if not _PWD_DIGIT_RE.search(value):
        raise ValueError("password must contain a digit")
    if value.strip() != value:
        raise ValueError("password must not have leading/trailing whitespace")
    return value


Password = Annotated[str, Field(min_length=_PASSWORD_MIN, max_length=_PASSWORD_MAX)]


class RegisterRequest(BaseModel):
    email: EmailStr
    password: Password
    full_name: SanitizedStr | None = Field(default=None, max_length=255)

    @field_validator("password")
    @classmethod
    def _pwd(cls, v: str) -> str:
        return _validate_password(v)


class LoginRequest(BaseModel):
    email: EmailStr
    password: Password


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str | None = None
    is_active: bool
    is_verified: bool
    created_at: datetime


class MeResponse(UserOut):
    pass
