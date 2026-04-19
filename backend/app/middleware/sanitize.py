"""HTML/script sanitization helpers.

Where we apply it:
  * `SanitizedStr` — Pydantic annotated type stripping HTML from user
    input (names, briefs, ad copy, etc.).
  * `SanitizeMiddleware` — last-resort defence; walks JSON request
    bodies and strips angle-bracket content from string values.

We intentionally reject HTML entirely rather than allow a subset: the
product copy that users submit is rendered as plain text in the UI and
in generated Excel, so keeping any HTML would be more risk than reward.
"""

from __future__ import annotations

import json
from typing import Annotated, Any

import bleach
from pydantic import AfterValidator
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp

# Zero-tag allowlist: strip everything, keep inner text.
_BLEACH_KWARGS: dict[str, Any] = {
    "tags": [],
    "attributes": {},
    "protocols": [],
    "strip": True,
    "strip_comments": True,
}

_MAX_LEN = 10_000


def sanitize_text(value: str) -> str:
    cleaned = bleach.clean(value, **_BLEACH_KWARGS)
    # bleach keeps escaped entities; normalise & collapse whitespace edges.
    cleaned = cleaned.replace("\u0000", "")
    return cleaned.strip()


def _validator(v: str) -> str:
    if not isinstance(v, str):
        raise TypeError("string required")
    if len(v) > _MAX_LEN:
        raise ValueError(f"string too long (> {_MAX_LEN})")
    return sanitize_text(v)


SanitizedStr = Annotated[str, AfterValidator(_validator)]
"""Drop-in replacement for `str` in Pydantic models when input is user text."""


class SanitizeMiddleware(BaseHTTPMiddleware):
    """Walk incoming JSON bodies and bleach every string value.

    This is a defence-in-depth layer for routes that take free-form JSON
    without a strict Pydantic schema.  It's a no-op for non-JSON bodies
    and silently passes through when parsing fails (handlers will 422).
    """

    def __init__(self, app: ASGIApp, max_bytes: int = 2 * 1024 * 1024):
        super().__init__(app)
        self.max_bytes = max_bytes

    async def dispatch(self, request: Request, call_next) -> Response:
        content_type = request.headers.get("content-type", "")
        if "application/json" not in content_type.lower():
            return await call_next(request)

        raw = await request.body()
        if not raw or len(raw) > self.max_bytes:
            return await call_next(request)

        try:
            payload = json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return await call_next(request)

        cleaned = _scrub(payload)
        new_body = json.dumps(cleaned, ensure_ascii=False).encode("utf-8")

        async def receive():
            return {"type": "http.request", "body": new_body, "more_body": False}

        request._receive = receive  # type: ignore[attr-defined]
        return await call_next(request)


def _scrub(value: Any) -> Any:
    if isinstance(value, str):
        return sanitize_text(value)
    if isinstance(value, list):
        return [_scrub(item) for item in value]
    if isinstance(value, dict):
        return {k: _scrub(v) for k, v in value.items()}
    return value
