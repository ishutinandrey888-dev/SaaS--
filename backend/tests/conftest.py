"""Pytest setup.

Must run BEFORE any `app.*` import: Settings require DATABASE_URL_*
and crash on instantiation otherwise.  We populate dummy URLs here —
tests that need real DB/OpenAI access override per-test.
"""

from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

os.environ.setdefault("ENV", "dev")
os.environ.setdefault(
    "DATABASE_URL_ADMIN",
    "postgresql+asyncpg://admin:test@localhost:5432/test",
)
os.environ.setdefault(
    "DATABASE_URL_USER",
    "postgresql+asyncpg://app_user:test@localhost:5432/test",
)
os.environ.setdefault(
    "DATABASE_URL_SYNC",
    "postgresql+psycopg2://admin:test@localhost:5432/test",
)
os.environ.setdefault("JWT_SECRET", "test-secret-at-least-32-characters-long-xxx")
os.environ.setdefault("OPENAI_API_KEY", "")
os.environ.setdefault("REDIS_URL", "")

import pytest  # noqa: E402


@pytest.fixture
def test_user():
    from app.models.user import User

    return User(
        id=uuid.uuid4(),
        email="test@example.com",
        password_hash="x",
        full_name="Tester",
        is_active=True,
        is_verified=True,
    )


@pytest.fixture
def anon_client():
    """TestClient with no auth overrides — used to assert 401s."""
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)


@pytest.fixture
def auth_client(test_user, monkeypatch):
    """TestClient with auth + RLS session + audit + rate-limit stubbed out."""
    from fastapi.testclient import TestClient

    from app.core.database import get_db_user
    from app.main import app
    from app.middleware.auth import get_current_user, get_optional_user
    from app.middleware.rate_limit import limiter
    from app.services import audit as audit_mod

    limiter.enabled = False

    async def _user_dep():
        return test_user

    async def _db_dep():
        class _FakeResult:
            def first(self):
                return None

            def scalar(self):
                return None

        class _FakeSession:
            info: dict = {}

            async def execute(self, *_args, **_kwargs):
                return _FakeResult()

        yield _FakeSession()

    async def _audit_noop(**_kwargs):
        return None

    app.dependency_overrides[get_current_user] = _user_dep
    app.dependency_overrides[get_optional_user] = _user_dep
    app.dependency_overrides[get_db_user] = _db_dep
    monkeypatch.setattr(audit_mod, "log", _audit_noop)

    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
        limiter.enabled = True
