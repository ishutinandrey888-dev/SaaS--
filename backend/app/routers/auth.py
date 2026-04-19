"""Authentication endpoints.

Token strategy:
  * Short-lived access JWT (default 15m) in `Authorization: Bearer`
    header.  We also mirror it into an `access_token` httpOnly cookie
    so the Next.js app can call SSE endpoints without a manual header.
  * Long-lived refresh JWT (default 30d) in a `refresh_token`
    httpOnly cookie scoped to `/auth/refresh`, so XHR from other paths
    can't inadvertently send it.
  * Refresh rotates on every use: old refresh token is replaced by a
    new one, and the new access token is issued alongside.

Brute-force protection lives in `BruteForceGuard` (per email+IP).
Per-IP edge throttling is applied via slowapi decorators below; nginx
adds an outer 5r/s limit for /auth/* as a safety net.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.middleware.auth import CurrentUser
from app.middleware.rate_limit import BruteForceError, BruteForceGuard, limiter
from app.models.subscription import Subscription
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    MeResponse,
    RegisterRequest,
    TokenResponse,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()

_ACCESS_COOKIE = "access_token"
_REFRESH_COOKIE = "refresh_token"
_REFRESH_PATH = "/auth/refresh"


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()
    return request.client.host if request.client else None


def _cookie_kwargs(*, max_age: int, path: str) -> dict:
    # Secure cookies in every non-dev environment.  SameSite=lax is the
    # right balance for a same-origin SPA served from the same domain
    # as the API (which is our nginx layout).
    return dict(
        httponly=True,
        secure=settings.env != "dev",
        samesite="lax",
        max_age=max_age,
        path=path,
    )


def _set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    response.set_cookie(
        _ACCESS_COOKIE,
        access,
        **_cookie_kwargs(
            max_age=settings.jwt_access_ttl_minutes * 60,
            path="/",
        ),
    )
    response.set_cookie(
        _REFRESH_COOKIE,
        refresh,
        **_cookie_kwargs(
            max_age=settings.jwt_refresh_ttl_days * 24 * 3600,
            path=_REFRESH_PATH,
        ),
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(_ACCESS_COOKIE, path="/")
    response.delete_cookie(_REFRESH_COOKIE, path=_REFRESH_PATH)


def _issue_tokens(user: User) -> tuple[str, str, int]:
    access = create_access_token(str(user.id), extra={"email": user.email})
    refresh = create_refresh_token(str(user.id))
    return access, refresh, settings.jwt_access_ttl_minutes * 60


# ---------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------
@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("5/minute")
async def register(
    request: Request,
    response: Response,
    payload: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    email_norm = payload.email.strip().lower()

    existing = await db.execute(select(User).where(User.email == email_norm))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="email_already_registered")

    user = User(
        email=email_norm,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        is_active=True,
        is_verified=False,
    )
    db.add(user)

    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="email_already_registered") from exc

    # Free subscription row so every paying user has one to update later.
    db.add(Subscription(user_id=user.id, plan="free", status="active"))
    await db.flush()

    access, refresh, ttl = _issue_tokens(user)
    _set_auth_cookies(response, access, refresh)
    return TokenResponse(access_token=access, expires_in=ttl)


# ---------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------
@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    response: Response,
    payload: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    email_norm = payload.email.strip().lower()
    ip = _client_ip(request)

    try:
        await BruteForceGuard.check(db, email=email_norm, ip=ip)
    except BruteForceError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="account_locked",
            headers={"Retry-After": str(exc.retry_after)},
        ) from exc

    user = (
        await db.execute(select(User).where(User.email == email_norm))
    ).scalar_one_or_none()

    ok = bool(user) and verify_password(payload.password, user.password_hash)
    await BruteForceGuard.record(db, email=email_norm, ip=ip, success=ok)

    if not ok or user is None:
        # Identical error for unknown email / wrong password — avoids enumeration.
        raise HTTPException(status_code=401, detail="invalid_credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="user_disabled")

    access, refresh, ttl = _issue_tokens(user)
    _set_auth_cookies(response, access, refresh)
    return TokenResponse(access_token=access, expires_in=ttl)


# ---------------------------------------------------------------------
# Refresh
# ---------------------------------------------------------------------
@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("30/minute")
async def refresh(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    token = request.cookies.get(_REFRESH_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="refresh_missing")

    try:
        payload = decode_token(token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="refresh_invalid") from exc

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="wrong_token_type")

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="refresh_invalid")

    user = (
        await db.execute(select(User).where(User.id == sub))
    ).scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="user_not_found")

    access, new_refresh, ttl = _issue_tokens(user)
    _set_auth_cookies(response, access, new_refresh)
    return TokenResponse(access_token=access, expires_in=ttl)


# ---------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------
@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> Response:
    _clear_auth_cookies(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


# ---------------------------------------------------------------------
# Me
# ---------------------------------------------------------------------
@router.get("/me", response_model=MeResponse)
async def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)
