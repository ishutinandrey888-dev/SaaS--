"""Thin YooKassa API client.

Two modes:
  * **real** — when `yukassa_shop_id` + `yukassa_secret_key` are set,
    hits https://api.yookassa.ru/v3/payments with HTTP Basic auth and
    an idempotency key.
  * **stub** — when either credential is missing, returns a fake
    `id` + `confirmation_url` so `/billing/create-payment` still
    works in dev + tests.  The stub `confirmation_url` is a
    same-origin stand-in that the frontend can redirect to; we ship
    a matching dev page so the flow demos end-to-end.

Webhook parsing is provider-shaped: YooKassa posts
`{"event": "...", "object": {...}}` where `object` is the same shape
as the create-payment response.  We read `object.id` and `object.status`
and ignore the rest.

Webhook authentication: YooKassa doesn't sign webhooks, so we pin the
source by IP.  The `yukassa_webhook_ips` env is a comma-separated CIDR
list (their published notification IPs).  Empty config means dev mode
and we fall back to loopback only — an unconfigured prod deploy still
can't be exploited by a random internet host.
"""

from __future__ import annotations

import base64
import ipaddress
import logging
import uuid
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger("payments.yookassa")

_API_BASE = "https://api.yookassa.ru/v3"
_TIMEOUT_S = 15.0

_LOOPBACK_NETWORKS: tuple[ipaddress.IPv4Network | ipaddress.IPv6Network, ...] = (
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
)


@dataclass(frozen=True)
class ProviderPayment:
    provider: str  # "yookassa" or "stub"
    id: str
    status: str  # yookassa: pending | waiting_for_capture | succeeded | canceled
    confirmation_url: str | None


def _is_configured() -> bool:
    s = get_settings()
    return bool(s.yukassa_shop_id and s.yukassa_secret_key)


def _auth_header() -> dict[str, str]:
    s = get_settings()
    raw = f"{s.yukassa_shop_id}:{s.yukassa_secret_key}".encode()
    token = base64.b64encode(raw).decode()
    return {"Authorization": f"Basic {token}"}


async def create_payment(
    *,
    amount_minor: int,
    currency: str,
    description: str,
    return_url: str,
    idempotency_key: str,
    metadata: dict[str, Any] | None = None,
) -> ProviderPayment:
    """Create a provider payment and return its id + confirmation URL.

    YooKassa expects `amount.value` as a decimal string with two
    fractional digits — "123.45".  We pass minor units internally and
    format at the boundary.
    """
    if not _is_configured():
        # Stub: good enough for dev/tests.  The caller already threaded
        # the payment id into `return_url`, so the frontend success
        # page can poll immediately.
        fake_id = f"stub-{uuid.uuid4().hex[:12]}"
        sep = "&" if "?" in return_url else "?"
        return ProviderPayment(
            provider="stub",
            id=fake_id,
            status="pending",
            confirmation_url=f"{return_url}{sep}stub=1",
        )

    value = f"{amount_minor / 100:.2f}"
    body: dict[str, Any] = {
        "amount": {"value": value, "currency": currency},
        "capture": True,
        "description": description,
        "confirmation": {
            "type": "redirect",
            "return_url": return_url,
        },
    }
    if metadata:
        body["metadata"] = {k: str(v)[:512] for k, v in metadata.items()}

    headers = {
        **_auth_header(),
        "Content-Type": "application/json",
        "Idempotence-Key": idempotency_key,
    }

    async with httpx.AsyncClient(timeout=_TIMEOUT_S) as client:
        response = await client.post(
            f"{_API_BASE}/payments", json=body, headers=headers
        )
    if response.status_code >= 400:
        logger.error(
            "yookassa_create_failed status=%s body=%s",
            response.status_code,
            response.text[:400],
        )
        raise RuntimeError("provider_error")

    data = response.json()
    conf_url = (data.get("confirmation") or {}).get("confirmation_url")
    return ProviderPayment(
        provider="yookassa",
        id=str(data["id"]),
        status=str(data.get("status") or "pending"),
        confirmation_url=conf_url,
    )


def _parse_networks(raw: str) -> list[ipaddress.IPv4Network | ipaddress.IPv6Network]:
    nets: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = []
    for token in raw.split(","):
        token = token.strip()
        if not token:
            continue
        try:
            nets.append(ipaddress.ip_network(token, strict=False))
        except ValueError:
            logger.warning("webhook_ip_parse_failed token=%r", token)
    return nets


def is_webhook_source_allowed(client_ip: str | None) -> bool:
    """True if `client_ip` is in the configured allowlist.

    Empty allowlist → loopback only (dev default).  Malformed / missing
    IP → deny.  We never trust `X-Forwarded-For` blindly; the caller
    normalises that before passing it in.
    """
    if not client_ip:
        return False
    try:
        ip = ipaddress.ip_address(client_ip)
    except ValueError:
        return False

    s = get_settings()
    nets = _parse_networks(s.yukassa_webhook_ips)
    if not nets:
        return any(ip in net for net in _LOOPBACK_NETWORKS)
    return any(ip in net for net in nets)


def parse_webhook(payload: dict[str, Any]) -> tuple[str, str] | None:
    """Return `(provider_payment_id, status)` or None if unparseable.

    YooKassa event envelope:
      {"event": "payment.succeeded", "object": {"id": "...", "status": "succeeded", ...}}
    """
    obj = payload.get("object")
    if not isinstance(obj, dict):
        return None
    pid = obj.get("id")
    status = obj.get("status")
    if not isinstance(pid, str) or not isinstance(status, str):
        return None
    return pid, status
