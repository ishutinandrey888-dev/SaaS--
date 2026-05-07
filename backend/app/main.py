"""FastAPI application entrypoint."""

from __future__ import annotations

import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings
from app.middleware.rate_limit import limiter, ratelimit_exceeded_handler
from app.middleware.sanitize import SanitizeMiddleware
from app.routers import admin as admin_router
from app.routers import agents as agents_router
from app.routers import auth as auth_router
from app.routers import billing as billing_router
from app.routers import dashboard as dashboard_router
from app.routers import health as health_router
from app.routers import projects as projects_router
from app.routers import yandex as yandex_router

settings = get_settings()

logging.basicConfig(
    level=logging.INFO if settings.env != "dev" else logging.DEBUG,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("app")


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Attach an X-Request-Id to every request and access-log it."""

    async def dispatch(self, request, call_next):
        rid = request.headers.get("x-request-id") or uuid.uuid4().hex[:16]
        request.state.request_id = rid
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            logger.exception("unhandled_error rid=%s path=%s", rid, request.url.path)
            raise
        took_ms = (time.perf_counter() - start) * 1000
        response.headers["X-Request-Id"] = rid
        logger.info(
            "req rid=%s method=%s path=%s status=%s ms=%.1f",
            rid, request.method, request.url.path, response.status_code, took_ms,
        )
        return response


def create_app() -> FastAPI:
    app = FastAPI(
        title="SaaS Direct — AI ad constructor & analyst",
        version="0.1.0",
        docs_url="/docs" if settings.env != "prod" else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.env != "prod" else None,
    )

    # --- Middleware stack (outermost first) --------------------------
    app.add_middleware(RequestIdMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-Id"],
        expose_headers=["X-Request-Id"],
        max_age=600,
    )

    app.add_middleware(SanitizeMiddleware)

    # --- Rate limiting -----------------------------------------------
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, ratelimit_exceeded_handler)

    # --- Routers -----------------------------------------------------
    app.include_router(health_router.router)
    app.include_router(auth_router.router)
    app.include_router(projects_router.router)
    app.include_router(yandex_router.router)
    app.include_router(agents_router.router)
    app.include_router(billing_router.router)
    app.include_router(dashboard_router.router)
    app.include_router(admin_router.router)

    @app.middleware("http")
    async def attach_limiter_state(request: Request, call_next):
        # slowapi reads Limiter from app.state; nothing else needed, but
        # we surface request_id in error bodies via state.
        return await call_next(request)

    return app


app = create_app()
