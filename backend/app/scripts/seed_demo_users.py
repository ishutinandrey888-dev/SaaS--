"""Seed demo users for local development.

Usage (inside backend container):
    docker compose exec backend python -m app.scripts.seed_demo_users

Creates two users:
- test@dozim.ai  / password — regular user (plan=free)
- admin@dozim.ai / password — admin (matches ADMIN_EMAILS default)

Idempotent: if a user already exists, leaves it alone.
"""

from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from app.core.database import AsyncSessionAdmin
from app.core.security import hash_password
from app.models.user import User

logger = logging.getLogger("seed")

DEMO_USERS = [
    {"email": "test@dozim.ai", "full_name": "Test User", "plan": "free"},
    {"email": "admin@dozim.ai", "full_name": "Admin", "plan": "pro"},
]
DEMO_PASSWORD = "password"


async def main() -> None:
    pwd = hash_password(DEMO_PASSWORD)
    async with AsyncSessionAdmin() as session:
        async with session.begin():
            for spec in DEMO_USERS:
                existing = (
                    await session.execute(select(User).where(User.email == spec["email"]))
                ).scalar_one_or_none()
                if existing:
                    print(f"  · {spec['email']} already exists — skipped")
                    continue
                user = User(
                    email=spec["email"],
                    password_hash=pwd,
                    full_name=spec["full_name"],
                    is_active=True,
                    is_verified=True,
                    plan=spec["plan"],
                )
                session.add(user)
                print(f"  + {spec['email']} ({spec['plan']}) — created")
    print("\nDemo credentials: <email> / password")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
