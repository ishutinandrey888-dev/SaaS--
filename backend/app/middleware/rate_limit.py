"""Rate-limit infrastructure.

SlowAPI gives us per-endpoint decorators (`@limiter.limit(...)`).  In
addition, login/registration need per-email brute-force protection that
goes beyond per-IP throttling; that lives in `BruteForceGuard`.

Limiter storage:
  * Redis when REDIS_URL is reachable (shared across workers).
  * Falls back to in-memory for local dev / tests.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import Request
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.login_attempt import LoginAttempt

settings = get_settings()


def _storage_uri() -> str:
    # slowapi picks "memory://" or a limits storage URI.
    if settings.redis_url:
        return settings.redis_url
    return "memory://"


limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=_storage_uri(),
    strategy="fixed-window",
    headers_enabled=True,
    default_limits=["240/minute"],
)


def client_key(request: Request) -> str:
    """Prefer the JWT subject if authenticated, else the client IP."""
    user = getattr(request.state, "user_id", None)
    if user:
        return f"user:{user}"
    return f"ip:{get_remote_address(request)}"


class BruteForceError(Exception):
    """Raised when an account/ip is temporarily locked after failed logins."""

    def __init__(self, retry_after_seconds: int):
        super().__init__("brute_force_lock")
        self.retry_after = retry_after_seconds


class BruteForceGuard:
    """Track failed login attempts per email+ip combo.

    Policy:
      * Window = 15 minutes.
      * >=5 failures in the window -> block for 15 minutes.
      * A successful login clears the email's counter implicitly (we
        just stop counting failures; rows are kept for auditing).
    """

    WINDOW = timedelta(minutes=15)
    MAX_FAILURES = 5
    LOCK_FOR = timedelta(minutes=15)

    @classmethod
    async def check(
        cls, db: AsyncSession, *, email: str, ip: str | None
    ) -> None:
        now = datetime.now(UTC)
        since = now - cls.WINDOW

        stmt = (
            select(func.count(LoginAttempt.id))
            .where(LoginAttempt.email == email)
            .where(LoginAttempt.success.is_(False))
            .where(LoginAttempt.created_at >= since)
        )
        if ip:
            stmt = stmt.where(LoginAttempt.ip_address == ip)

        failures = (await db.execute(stmt)).scalar_one()
        if failures >= cls.MAX_FAILURES:
            retry_after = int(cls.LOCK_FOR.total_seconds())
            raise BruteForceError(retry_after)

    @classmethod
    async def record(
        cls,
        db: AsyncSession,
        *,
        email: str,
        ip: str | None,
        success: bool,
    ) -> None:
        db.add(
            LoginAttempt(
                email=email.lower(),
                ip_address=ip,
                success=success,
            )
        )
        await db.flush()


def ratelimit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """JSON response for slowapi's RateLimitExceeded."""
    from fastapi.responses import JSONResponse

    return JSONResponse(
        status_code=429,
        content={
            "detail": "rate_limited",
            "message": "Too many requests. Try again later.",
        },
        headers={"Retry-After": "60"},
    )
