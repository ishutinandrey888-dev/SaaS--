"""Two-engine database access.

* `engine_admin` — connects as the service/owner role (BYPASSRLS).
  Use it for:
    - auth (register/login — the user may not exist yet),
    - Celery tasks and background jobs,
    - payment webhooks,
    - audit log writes,
    - anything RLS-insensitive.

* `engine_user` — connects as the restricted `app_user` Postgres role
  (NOBYPASSRLS).  Before yielding a session to the route handler we
  run `set_config('request.jwt.claim.sub', <user_id>, true)` inside a
  transaction, so the RLS helper `public.current_app_user_id()` returns
  that UUID and every policy filters by it.

Contract:
    * `AdminDB` dependency -> session over `engine_admin`, plain
      commit-on-success semantics.
    * `UserDB` dependency  -> session over `engine_user`, already inside
      a transaction bound to the authenticated user's id.  If the route
      raises, the transaction rolls back and the claim context is lost
      automatically (the connection returns to the pool clean).
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

settings = get_settings()


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


# ---------------------------------------------------------------------
# Engines
# ---------------------------------------------------------------------
engine_admin = create_async_engine(
    settings.database_url_admin,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=False,
)

engine_user = create_async_engine(
    settings.database_url_user,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=False,
)

AsyncSessionAdmin = async_sessionmaker(
    bind=engine_admin,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)

AsyncSessionUser = async_sessionmaker(
    bind=engine_user,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


# ---------------------------------------------------------------------
# Admin dependency — RLS-bypassing session
# ---------------------------------------------------------------------
async def get_db_admin() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionAdmin() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


AdminDB = Annotated[AsyncSession, Depends(get_db_admin)]


# ---------------------------------------------------------------------
# User dependency — RLS-enforcing session
# ---------------------------------------------------------------------
# Imported lazily to avoid a circular import (middleware/auth.py imports
# `AdminDB` from this module to verify JWTs).
def _current_user_dep():
    from app.middleware.auth import get_current_user
    return get_current_user


async def get_db_user(
    user=Depends(_current_user_dep()),
) -> AsyncGenerator[AsyncSession, None]:
    """Yield a session whose JWT claim is pinned to `user.id` for the
    duration of a single transaction.  RLS policies then filter every
    query to rows owned by this user.
    """
    async with AsyncSessionUser() as session:
        async with session.begin():
            # Parameterised via set_config (SET LOCAL doesn't bind easily).
            # `is_local=true` scopes the setting to this transaction only.
            await session.execute(
                text("SELECT set_config('request.jwt.claim.sub', :uid, true)"),
                {"uid": str(user.id)},
            )
            yield session


UserDB = Annotated[AsyncSession, Depends(get_db_user)]


__all__ = [
    "AdminDB",
    "AsyncSessionAdmin",
    "AsyncSessionUser",
    "Base",
    "UserDB",
    "engine_admin",
    "engine_user",
    "get_db_admin",
    "get_db_user",
]
