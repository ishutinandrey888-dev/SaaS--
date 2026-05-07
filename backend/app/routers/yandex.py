"""Yandex Direct OAuth + ad_accounts surface."""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import select

from app.core.database import AdminDB, UserDB
from app.core.security import encrypt_value
from app.middleware.auth import CurrentUser
from app.middleware.rate_limit import limiter
from app.models.ad_account import AdAccount
from app.models.project import Project
from app.schemas.ad_account import AdAccountOut, OAuthStartResponse
from app.services import audit, events
from app.services.yandex_oauth import (
    OAuthError,
    authorize_url,
    exchange_code,
    is_stub_mode,
    make_state,
    parse_state,
)

router = APIRouter(prefix="/yandex", tags=["yandex"])
logger = logging.getLogger("yandex_router")


@router.get("/oauth/start", response_model=OAuthStartResponse)
@limiter.limit("10/minute")
async def oauth_start(
    request: Request,
    user: CurrentUser,
    db: UserDB,
    project_id: uuid.UUID = Query(..., description="Target project for the connection"),
) -> OAuthStartResponse:
    project = (
        await db.execute(select(Project).where(Project.id == project_id))
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="project_not_found")

    state = make_state(str(user.id), str(project_id))
    return OAuthStartResponse(url=authorize_url(state), stub=is_stub_mode())


@router.get("/oauth/callback")
@limiter.limit("30/minute")
async def oauth_callback(
    request: Request,
    db: AdminDB,
    code: str | None = Query(None),
    state: str | None = Query(None),
    error: str | None = Query(None),
):
    """OAuth redirect endpoint.

    Uses AdminDB (RLS-bypass) because the request comes from the
    provider, not the user — there's no JWT on the URL.  The state JWT
    carries user_id, so we still write under the right owner.
    """
    if error:
        return HTMLResponse(_close_window_html(f"Yandex denied: {error}"), status_code=400)
    if not code or not state:
        raise HTTPException(status_code=400, detail="missing_code_or_state")

    try:
        user_id, project_id = parse_state(state)
    except OAuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        bundle = await exchange_code(code)
    except OAuthError as exc:
        await audit.log(
            action=audit.Action.OAUTH_YANDEX_GRANTED,
            request=request,
            user=user_id,
            success=False,
            meta={"error": str(exc)},
        )
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    enc_access = encrypt_value(bundle.access_token)
    enc_refresh = encrypt_value(bundle.refresh_token) if bundle.refresh_token else None

    account = AdAccount(
        project_id=uuid.UUID(project_id),
        user_id=uuid.UUID(user_id),
        provider="yandex_direct",
        external_id=bundle.external_id,
        access_token=enc_access,
        refresh_token=enc_refresh,
        expires_at=bundle.expires_at,
        status="active",
        meta={"stub": is_stub_mode()},
    )
    db.add(account)
    await db.flush()

    await audit.log(
        action=audit.Action.OAUTH_YANDEX_GRANTED,
        request=request,
        user=user_id,
        resource_type="ad_account",
        resource_id=account.id,
        meta={"external_id": bundle.external_id},
    )
    await events.emit(
        db,
        name="oauth.yandex.granted",
        user_id=uuid.UUID(user_id),
        subject_type="ad_account",
        subject_id=account.id,
        payload={"external_id": bundle.external_id, "stub": is_stub_mode()},
    )

    return HTMLResponse(_close_window_html("Аккаунт подключён."))


@router.get("/ad-accounts", response_model=list[AdAccountOut])
async def list_accounts(user: CurrentUser, db: UserDB) -> list[AdAccountOut]:
    rows = (
        await db.execute(
            select(AdAccount).order_by(AdAccount.created_at.desc())
        )
    ).scalars().all()
    return [AdAccountOut.model_validate(r) for r in rows]


@router.delete("/ad-accounts/{account_id}", status_code=204)
async def disconnect_account(
    request: Request,
    account_id: uuid.UUID,
    user: CurrentUser,
    db: UserDB,
):
    account = (
        await db.execute(
            select(AdAccount).where(AdAccount.id == account_id)
        )
    ).scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=404, detail="ad_account_not_found")

    account.status = "revoked"
    account.access_token = ""
    account.refresh_token = None
    await db.flush()

    await audit.log(
        action=audit.Action.OAUTH_YANDEX_REVOKED,
        request=request,
        user=user,
        resource_type="ad_account",
        resource_id=account.id,
    )
    return RedirectResponse(url="/yandex/ad-accounts", status_code=204)


def _close_window_html(message: str) -> str:
    safe = message.replace("<", "&lt;").replace(">", "&gt;")
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>{safe}</title></head>
<body style="font-family: system-ui; padding: 2rem; text-align: center;">
  <p>{safe}</p>
  <p>Окно можно закрыть.</p>
  <script>
    try {{ window.opener && window.opener.postMessage({{type:'yandex-oauth', ok:true}}, '*'); }} catch(e) {{}}
    setTimeout(() => window.close(), 1500);
  </script>
</body></html>
"""
