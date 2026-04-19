"""JWT-based authentication dependencies.

Token delivery:
  * Access token  — `Authorization: Bearer <token>` or `access_token` cookie.
  * Refresh token — `refresh_token` httpOnly cookie (handled in auth router).

Backend issues JWTs itself (see `core.security`); we do not verify
Supabase-issued tokens here.  If a future admin tool uses Supabase Auth
directly, add a parallel verifier — don't overload this one.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User

# auto_error=False: we also accept the cookie, so let _extract_token decide.
_bearer_scheme = HTTPBearer(auto_error=False, bearerFormat="JWT")

_COOKIE_NAME = "access_token"


def _extract_token(request: Request) -> str | None:
    authz = request.headers.get("authorization")
    if authz:
        parts = authz.split(None, 1)
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1].strip()
            if token:
                return token
    cookie = request.cookies.get(_COOKIE_NAME)
    return cookie or None


async def get_current_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    token = _extract_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="auth_required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_token(token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="wrong_token_type",
        )

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="invalid_token")

    try:
        user_id = uuid.UUID(str(sub))
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="invalid_token") from exc

    stmt = select(User).where(User.id == user_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="user_not_found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="user_disabled")

    request.state.user_id = str(user.id)
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_optional_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User | None:
    """Variant that returns None when no/invalid token is provided."""
    if not _extract_token(request):
        return None
    try:
        return await get_current_user(request, db)
    except HTTPException:
        return None


OptionalUser = Annotated[User | None, Depends(get_optional_user)]


# Keep the scheme importable for OpenAPI docs even though we don't use it directly.
__all__ = [
    "CurrentUser",
    "OptionalUser",
    "get_current_user",
    "get_optional_user",
    "_bearer_scheme",
]
