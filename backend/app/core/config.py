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

    database_url: str = Field(..., description="Async SQLAlchemy URL (asyncpg)")
    database_url_sync: str = Field(..., description="Sync URL used by Alembic")

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
