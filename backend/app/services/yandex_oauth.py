"""Yandex OAuth — code-grant flow for Яндекс Директ access.

Flow:
  1. /yandex/oauth/start  → 302 to oauth.yandex.ru with our state JWT.
  2. user logs in at Яндекс, grants direct:api scope.
  3. /yandex/oauth/callback?code=...&state=...
     - we verify state JWT (signed by jwt_secret),
     - exchange `code` for {access_token, refresh_token, expires_in} via
       https://oauth.yandex.ru/token,
     - encrypt both tokens with Fernet, persist into ad_accounts.

In dev/stub mode (settings.yandex_direct_client_id == ""), /start redirects
to a local URL that immediately calls /callback with a stub code; the
callback then synthesises a fake account.  Lets the demo work without
registering an OAuth app at id.yandex.ru.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from jose import JWTError, jwt

from app.core.config import get_settings

logger = logging.getLogger("yandex_oauth")

_OAUTH_TOKEN_URL = "https://oauth.yandex.ru/token"
_OAUTH_AUTHORIZE_URL = "https://oauth.yandex.ru/authorize"
_STATE_TTL_S = 5 * 60
_STATE_TYPE = "yandex_oauth_state"

_STUB_CODE = "stub-code"


@dataclass
class TokenBundle:
    access_token: str
    refresh_token: str | None
    expires_at: datetime
    external_id: str  # Yandex login or numeric id


class OAuthError(Exception):
    pass


def _settings():
    return get_settings()


def is_stub_mode() -> bool:
    return not _settings().yandex_direct_client_id


def make_state(user_id: str, project_id: str) -> str:
    s = _settings()
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "type": _STATE_TYPE,
        "uid": str(user_id),
        "pid": str(project_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=_STATE_TTL_S)).timestamp()),
    }
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)


def parse_state(state: str) -> tuple[str, str]:
    s = _settings()
    try:
        payload = jwt.decode(state, s.jwt_secret, algorithms=[s.jwt_algorithm])
    except JWTError as exc:
        raise OAuthError("invalid_state") from exc
    if payload.get("type") != _STATE_TYPE:
        raise OAuthError("wrong_state_type")
    uid = payload.get("uid")
    pid = payload.get("pid")
    if not uid or not pid:
        raise OAuthError("malformed_state")
    return str(uid), str(pid)


def authorize_url(state: str) -> str:
    s = _settings()
    if is_stub_mode():
        # In stub mode skip the provider entirely: hand back a URL that
        # bounces straight to our callback with a stub code.  The frontend
        # opens this in a new window; the callback closes the window.
        from urllib.parse import urlencode

        return (
            s.yandex_direct_oauth_redirect_url
            + "?"
            + urlencode({"code": _STUB_CODE, "state": state})
        )
    from urllib.parse import urlencode

    params = {
        "response_type": "code",
        "client_id": s.yandex_direct_client_id,
        "redirect_uri": s.yandex_direct_oauth_redirect_url,
        "state": state,
    }
    return f"{_OAUTH_AUTHORIZE_URL}?{urlencode(params)}"


async def exchange_code(code: str) -> TokenBundle:
    """Trade `code` for tokens.  Raises OAuthError on any failure."""
    s = _settings()

    if is_stub_mode():
        # Synthetic tokens valid forever; the API client won't be called
        # in stub mode anyway (the agent runner uses fake-data path).
        return TokenBundle(
            access_token="stub-access-token",
            refresh_token="stub-refresh-token",
            expires_at=datetime.now(timezone.utc) + timedelta(days=365),
            external_id="stub-direct-account",
        )

    data = {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": s.yandex_direct_client_id,
        "client_secret": s.yandex_direct_client_secret,
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(_OAUTH_TOKEN_URL, data=data)
    except httpx.HTTPError as exc:
        raise OAuthError(f"token_exchange_failed: {exc}") from exc

    if r.status_code != 200:
        raise OAuthError(f"token_exchange_status_{r.status_code}: {r.text[:256]}")

    body = r.json()
    access = body.get("access_token")
    if not access:
        raise OAuthError("token_exchange_no_access_token")
    refresh = body.get("refresh_token")
    expires_in = int(body.get("expires_in", 0) or 0)

    # Direct API uses Yandex login as external account id; we fetch it
    # from id.yandex.ru/info.  Failure here is non-fatal; we fall back
    # to a placeholder.
    external_id = await _fetch_login(access) or "yandex-account"

    return TokenBundle(
        access_token=access,
        refresh_token=refresh,
        expires_at=datetime.now(timezone.utc) + timedelta(seconds=max(expires_in, 60)),
        external_id=external_id,
    )


async def _fetch_login(access_token: str) -> str | None:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(
                "https://login.yandex.ru/info",
                params={"format": "json"},
                headers={"Authorization": f"OAuth {access_token}"},
            )
        if r.status_code != 200:
            return None
        info = r.json()
        # `login` (string) or `id` (string) are both stable enough to
        # pin our row to.  Prefer login for human readability.
        return str(info.get("login") or info.get("id") or "") or None
    except (httpx.HTTPError, ValueError):
        return None


async def refresh_token(refresh: str) -> TokenBundle:
    s = _settings()
    if is_stub_mode():
        return TokenBundle(
            access_token="stub-access-token",
            refresh_token=refresh,
            expires_at=datetime.now(timezone.utc) + timedelta(days=365),
            external_id="stub-direct-account",
        )
    data = {
        "grant_type": "refresh_token",
        "refresh_token": refresh,
        "client_id": s.yandex_direct_client_id,
        "client_secret": s.yandex_direct_client_secret,
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(_OAUTH_TOKEN_URL, data=data)
    except httpx.HTTPError as exc:
        raise OAuthError(f"refresh_failed: {exc}") from exc

    if r.status_code != 200:
        raise OAuthError(f"refresh_status_{r.status_code}: {r.text[:256]}")

    body = r.json()
    access = body.get("access_token")
    if not access:
        raise OAuthError("refresh_no_access_token")
    new_refresh = body.get("refresh_token") or refresh
    expires_in = int(body.get("expires_in", 0) or 0)

    return TokenBundle(
        access_token=access,
        refresh_token=new_refresh,
        expires_at=datetime.now(timezone.utc) + timedelta(seconds=max(expires_in, 60)),
        external_id="",
    )
