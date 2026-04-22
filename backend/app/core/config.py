from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    env: Literal["dev", "staging", "prod"] = "dev"

    # Two async engines — see app.core.database.  Admin bypasses RLS
    # (service/owner role); user does NOT bypass RLS (restricted role).
    database_url_admin: str = Field(
        ..., description="Async SQLAlchemy URL for the BYPASSRLS service role"
    )
    database_url_user: str = Field(
        ..., description="Async SQLAlchemy URL for the NOBYPASSRLS app_user role"
    )
    database_url_sync: str = Field(
        ..., description="Sync URL used by Alembic (admin credentials)"
    )

    # Per-engine pool sizing.  Two engines × db_pool_size connections are
    # opened at warm-up, burstable by db_max_overflow each.  Keep small
    # when pointing at Supabase direct port (5432, ~60 conn ceiling);
    # transaction pooler (6543) tolerates much higher.
    db_pool_size: int = 5
    db_max_overflow: int = 10

    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_anon_key: str = ""

    openai_api_key: str = ""
    openai_model: str = "gpt-4o"

    fernet_key: str = ""
    jwt_secret: str = "change-me-min-32-chars-long-secret-dev-only"
    jwt_access_ttl_minutes: int = 15
    jwt_refresh_ttl_days: int = 30
    jwt_algorithm: str = "HS256"

    redis_url: str = "redis://localhost:6379/0"

    yukassa_shop_id: str = ""
    yukassa_secret_key: str = ""
    # Where the user is redirected back to after provider-hosted checkout.
    payment_return_url: str = "http://localhost:3000/billing/success"

    pagespeed_api_key: str = ""

    max_upload_size_mb: int = 10
    upload_dir: str = "/tmp/uploads"

    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def max_upload_size_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
