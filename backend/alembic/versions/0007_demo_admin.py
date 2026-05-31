"""seed demo admin user

Revision ID: 0007_demo_admin
Revises: 0006_dozim_pivot
Create Date: 2026-05-24

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0007_demo_admin"
down_revision: Union[str, None] = "0006_dozim_pivot"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


DEMO_ADMIN_EMAIL = "admin@dozim.ai"
DEMO_ADMIN_PASSWORD_HASH = (
    "$2y$05$Hta0WZzJdMyySiDfJX13C.p4nZfImd9sAJU9mFQ3bY8iwOSV9Hzca"
)


def upgrade() -> None:
    op.execute(
        f"""
        INSERT INTO users (
          email,
          password_hash,
          full_name,
          is_active,
          is_verified,
          plan
        )
        VALUES (
          '{DEMO_ADMIN_EMAIL}',
          '{DEMO_ADMIN_PASSWORD_HASH}',
          'Demo Admin',
          true,
          true,
          'agency'
        )
        ON CONFLICT (email) DO UPDATE
        SET
          password_hash = EXCLUDED.password_hash,
          full_name = COALESCE(users.full_name, EXCLUDED.full_name),
          is_active = true,
          is_verified = true,
          plan = CASE
            WHEN users.plan = 'free' THEN 'agency'
            ELSE users.plan
          END,
          updated_at = now()
        """
    )


def downgrade() -> None:
    op.execute(f"DELETE FROM users WHERE email = '{DEMO_ADMIN_EMAIL}'")
