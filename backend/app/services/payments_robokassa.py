"""Thin Robokassa client.

Two modes:
  * **real** — when `robokassa_merchant_login` + both passwords are set,
    builds a redirect URL to https://auth.robokassa.ru/Merchant/Index.aspx
    signed with MD5(MerchantLogin:OutSum:InvId:password1[:shp_*]).
  * **stub** — when any credential is missing, returns a fake
    `confirmation_url` that bounces straight to /billing/success?stub=1
    so dev + tests still flow end-to-end.

Webhook (Result URL): Robokassa POSTs `application/x-www-form-urlencoded`
with `OutSum`, `InvId`, `SignatureValue` and any custom shp_* fields we
sent.  Signature: MD5(OutSum:InvId:password2[:shp_*]).  We validate
signature on every webhook before flipping any DB state.

This module is a drop-in replacement for `payments_yookassa` and exports
the same surface used by `app/services/payments.py`:

  - dataclass ProviderPayment(provider, id, status, confirmation_url)
  - async def create_payment(...)
  - def parse_webhook(form: dict) -> tuple[str, str] | None
  - def is_webhook_source_allowed(client_ip)
  - def verify_webhook_signature(form: dict) -> bool
"""

from __future__ import annotations

import hashlib
import ipaddress
import logging
import uuid
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode

from app.core.config import get_settings

logger = logging.getLogger("payments.robokassa")

_PROVIDER_NAME = "robokassa"
_REAL_BASE = "https://auth.robokassa.ru/Merchant/Index.aspx"
_TEST_BASE = "https://auth.robokassa.ru/Merchant/Index.aspx"

_LOOPBACK_NETWORKS: tuple[ipaddress.IPv4Network | ipaddress.IPv6Network, ...] = (
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
)


@dataclass(frozen=True)
class ProviderPayment:
    provider: str  # "robokassa" or "stub"
    id: str
    status: str  # "pending" | "succeeded" | "canceled" | "failed"
    confirmation_url: str | None


def _is_configured() -> bool:
    s = get_settings()
    return bool(
        s.robokassa_merchant_login
        and s.robokassa_password1
        and s.robokassa_password2
    )


def _md5(s: str) -> str:
    return hashlib.md5(s.encode("utf-8")).hexdigest()


def _format_amount(amount_minor: int) -> str:
    """Robokassa OutSum is "<rubles>.<kopecks>" with 2 fraction digits."""
    return f"{amount_minor / 100:.2f}"


def _shp_pairs(metadata: dict[str, Any] | None) -> list[tuple[str, str]]:
    """Custom shp_* params; alphabetical order required for the signature."""
    if not metadata:
        return []
    pairs = [(f"shp_{k}", str(v)[:128]) for k, v in metadata.items()]
    pairs.sort(key=lambda kv: kv[0])
    return pairs


async def create_payment(
    *,
    amount_minor: int,
    currency: str,
    description: str,
    return_url: str,
    idempotency_key: str,
    metadata: dict[str, Any] | None = None,
) -> ProviderPayment:
    """Build a payment URL.  Robokassa is redirect-only — no API call here."""
    if not _is_configured():
        # Stub: bounce to the success URL with a synthetic id.
        fake_id = f"stub-{uuid.uuid4().hex[:12]}"
        sep = "&" if "?" in return_url else "?"
        return ProviderPayment(
            provider="stub",
            id=fake_id,
            status="pending",
            confirmation_url=f"{return_url}{sep}stub=1",
        )

    s = get_settings()

    # Robokassa's InvId is a 32-bit int.  We compress the UUID's first
    # 8 hex digits into one — collisions across the lifetime of a small
    # SaaS are vanishingly unlikely; we still index by uuid in our DB.
    inv_id = int(idempotency_key.replace("-", "")[:8], 16)
    out_sum = _format_amount(amount_minor)

    shp = _shp_pairs(metadata)
    shp_signature_str = "".join(f":{k}={v}" for k, v in shp)
    raw = f"{s.robokassa_merchant_login}:{out_sum}:{inv_id}:{s.robokassa_password1}{shp_signature_str}"
    signature = _md5(raw).upper()

    params: list[tuple[str, str]] = [
        ("MerchantLogin", s.robokassa_merchant_login),
        ("OutSum", out_sum),
        ("InvId", str(inv_id)),
        ("Description", description[:100]),
        ("SignatureValue", signature),
    ]
    if s.robokassa_test_mode:
        params.append(("IsTest", "1"))
    params.extend(shp)

    return ProviderPayment(
        provider=_PROVIDER_NAME,
        id=str(inv_id),
        status="pending",
        confirmation_url=f"{_REAL_BASE if not s.robokassa_test_mode else _TEST_BASE}?{urlencode(params)}",
    )


def verify_webhook_signature(form: dict[str, Any]) -> bool:
    """True iff `SignatureValue` in `form` matches MD5 of the canonical string."""
    s = get_settings()
    if not s.robokassa_password2:
        # Without password2 we can't validate; stub mode trusts the call.
        return True

    out_sum = str(form.get("OutSum") or "").strip()
    inv_id = str(form.get("InvId") or "").strip()
    received = str(form.get("SignatureValue") or "").strip().upper()

    if not (out_sum and inv_id and received):
        return False

    shp_pairs = sorted(
        (k, str(v)) for k, v in form.items() if k.startswith("shp_")
    )
    shp_signature_str = "".join(f":{k}={v}" for k, v in shp_pairs)
    raw = f"{out_sum}:{inv_id}:{s.robokassa_password2}{shp_signature_str}"
    expected = _md5(raw).upper()

    return received == expected


def is_webhook_source_allowed(client_ip: str | None) -> bool:
    """IP allowlist for the webhook.  Empty config = no restriction
    (since Robokassa signs the payload).  Loopback always allowed."""
    if not client_ip:
        return False
    try:
        ip = ipaddress.ip_address(client_ip)
    except ValueError:
        return False

    s = get_settings()
    raw = (s.robokassa_webhook_ips or "").strip()
    if not raw:
        return True
    nets: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = []
    for token in raw.split(","):
        token = token.strip()
        if not token:
            continue
        try:
            nets.append(ipaddress.ip_network(token, strict=False))
        except ValueError:
            logger.warning("webhook_ip_parse_failed token=%r", token)
    if not nets:
        return any(ip in net for net in _LOOPBACK_NETWORKS)
    return any(ip in net for net in nets)


def parse_webhook(form: dict[str, Any]) -> tuple[str, str] | None:
    """Robokassa Result URL fires when the user finished payment.

    Form fields we care about:
      - InvId           — our payment id (we encoded it in create_payment)
      - OutSum
      - SignatureValue  — already validated by the caller
    Robokassa doesn't include a textual status; arrival on the success
    URL with a valid signature == "succeeded".  Failures don't fire
    Result URL at all (the user is bounced to FailURL instead).
    """
    inv_id = form.get("InvId")
    if not inv_id:
        return None
    return str(inv_id), "succeeded"
