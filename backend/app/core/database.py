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

import logging
from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger("db")


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


# ---------------------------------------------------------------------
# Engines
# ---------------------------------------------------------------------
# Pool sizing notes:
#   * The *transaction pooler* URL (Supabase port 6543) multiplexes many
#     async clients over a few physical connections, so small SQLAlchemy
#     pools are sufficient and recommended — see docs/vps-setup.md.
#   * Total workers = backend_replicas * (pool_size + max_overflow) * 2
#     engines + celery + alembic.  Keep the product well under the
#     Supabase connection limit (60 on Free tier direct, ~200 via pooler).
engine_admin = create_async_engine(
    settings.database_url_admin,
    pool_pre_ping=True,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_recycle=1800,
    echo=False,
)

engine_user = create_async_engine(
    settings.database_url_user,
    pool_pre_ping=True,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_recycle=1800,
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
        # Observability marker: code that accepts a raw AsyncSession can
        # assert `session.info.get("kind") == "user"` to fail loud when
        # an admin session sneaks into a user-scoped flow.
        session.info["kind"] = "admin"
        logger.debug("admin_session_opened")
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


_SET_CLAIM_SQL = text("SELECT set_config('request.jwt.claim.sub', :uid, true)")
_READ_CLAIM_SQL = text("SELECT current_setting('request.jwt.claim.sub', true)")


async def get_db_user(
    user=Depends(_current_user_dep()),
) -> AsyncGenerator[AsyncSession, None]:
    """Yield a session whose JWT claim is pinned to `user.id` for the
    duration of a single transaction.  RLS policies then filter every
    query to rows owned by this user.

    Fail-fast invariants:
      * `user` is a concrete authenticated user (get_current_user raises
        401 otherwise; this is belt-and-suspenders).
      * `set_config` actually applied — verified by reading back
        `current_setting`.  Catches the foot-gun where the URL was
        pointed at a role whose transaction state is stripped (e.g. a
        misconfigured pgbouncer pool mode).
    """
    uid = getattr(user, "id", None)
    if uid is None:
        # Guard: RLS with a NULL `request.jwt.claim.sub` evaluates to NULL
        # in every policy, which silently denies everything.  We prefer
        # a 500 to a confusing empty result.
        raise RuntimeError("get_db_user requires an authenticated user")
    uid = str(uid)

    async with AsyncSessionUser() as session:
        async with session.begin():
            await session.execute(_SET_CLAIM_SQL, {"uid": uid})

            applied = (await session.execute(_READ_CLAIM_SQL)).scalar()
            if applied != uid:
                raise RuntimeError(
                    "RLS claim failed to apply "
                    f"(expected={uid!r}, got={applied!r}). "
                    "Check DATABASE_URL_USER role and pgbouncer mode."
                )

            session.info["kind"] = "user"
            session.info["rls_user_id"] = uid
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
