"""Yandex Direct API v5 client.

Thin async wrapper over the JSON endpoints we actually call from the
agent runner.  All methods take a decoded `access_token`; refresh
handling is done one layer up so this module is stateless.

The full Direct API surface is huge (Reports, AudienceTargets, etc).
We only model what the agent flow needs in MVP:

  - get_campaigns       — list campaigns + budget + state
  - get_keywords        — list keywords for given ad-group ids
  - get_ads             — list ads for given ad-group ids
  - get_campaign_stats  — clicks / impressions / cost / conversions
  - update_campaign_budget
  - update_keyword_bid
  - pause_keyword

Errors:
  Two failure modes both raise `YandexDirectError`:
    * HTTP / network — captured as `kind="http"`.
    * API-level error envelope (`error.error_code`) — captured as
      `kind="api"`.  `error_code == 53` means token expired (refresh).
  Callers should catch and decide refresh / abort.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger("yandex_direct")

_TIMEOUT_S = 20.0


@dataclass
class YandexDirectError(Exception):
    kind: str  # "http" | "api"
    status_code: int | None
    error_code: int | None
    message: str

    def __str__(self) -> str:
        return f"[{self.kind} {self.error_code}/{self.status_code}] {self.message}"


def _base_url() -> str:
    return get_settings().yandex_direct_api_base.rstrip("/")


def _headers(access_token: str) -> dict[str, str]:
    # Direct API requires the token sans 'Bearer' prefix per its contract.
    return {
        "Authorization": f"Bearer {access_token}",
        "Accept-Language": "ru",
        "Content-Type": "application/json; charset=utf-8",
    }


async def _post(
    path: str,
    *,
    access_token: str,
    body: dict[str, Any],
) -> dict[str, Any]:
    url = f"{_base_url()}/{path.strip('/')}"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_S) as client:
            r = await client.post(url, headers=_headers(access_token), json=body)
    except httpx.HTTPError as exc:
        raise YandexDirectError(
            kind="http", status_code=None, error_code=None, message=str(exc)
        ) from exc

    # The Direct API returns 200 even for business-level errors and
    # encodes them in the response body under `error`.  Network /
    # auth-level failures use HTTP status codes.
    if r.status_code != 200:
        raise YandexDirectError(
            kind="http",
            status_code=r.status_code,
            error_code=None,
            message=r.text[:512],
        )

    data = r.json()
    if "error" in data:
        err = data["error"] or {}
        raise YandexDirectError(
            kind="api",
            status_code=200,
            error_code=int(err.get("error_code", 0) or 0),
            message=str(err.get("error_string") or err.get("error_detail") or "")[:512],
        )
    return data


# ---------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------
async def get_campaigns(access_token: str, *, login: str) -> list[dict[str, Any]]:
    body = {
        "method": "get",
        "params": {
            "SelectionCriteria": {},
            "FieldNames": ["Id", "Name", "Status", "State", "Type", "DailyBudget"],
        },
    }
    data = await _post("campaigns", access_token=access_token, body=body)
    return list(data.get("result", {}).get("Campaigns", []) or [])


async def get_ad_groups(
    access_token: str, *, campaign_ids: list[int]
) -> list[dict[str, Any]]:
    if not campaign_ids:
        return []
    body = {
        "method": "get",
        "params": {
            "SelectionCriteria": {"CampaignIds": campaign_ids},
            "FieldNames": ["Id", "Name", "CampaignId", "Status"],
        },
    }
    data = await _post("adgroups", access_token=access_token, body=body)
    return list(data.get("result", {}).get("AdGroups", []) or [])


async def get_keywords(
    access_token: str, *, ad_group_ids: list[int]
) -> list[dict[str, Any]]:
    if not ad_group_ids:
        return []
    body = {
        "method": "get",
        "params": {
            "SelectionCriteria": {"AdGroupIds": ad_group_ids},
            "FieldNames": ["Id", "Keyword", "AdGroupId", "Status", "State", "Bid"],
        },
    }
    data = await _post("keywords", access_token=access_token, body=body)
    return list(data.get("result", {}).get("Keywords", []) or [])


async def get_ads(
    access_token: str, *, ad_group_ids: list[int]
) -> list[dict[str, Any]]:
    if not ad_group_ids:
        return []
    body = {
        "method": "get",
        "params": {
            "SelectionCriteria": {"AdGroupIds": ad_group_ids},
            "FieldNames": ["Id", "AdGroupId", "Status", "State", "Type", "TextAd"],
        },
    }
    data = await _post("ads", access_token=access_token, body=body)
    return list(data.get("result", {}).get("Ads", []) or [])


# ---------------------------------------------------------------------
# Writes (used by 'auto' mode)
# ---------------------------------------------------------------------
async def update_campaign_budget(
    access_token: str, *, campaign_id: int, daily_budget_minor: int
) -> None:
    body = {
        "method": "update",
        "params": {
            "Campaigns": [
                {
                    "Id": campaign_id,
                    "DailyBudget": {
                        "Amount": daily_budget_minor,
                        "Mode": "STANDARD",
                    },
                }
            ]
        },
    }
    await _post("campaigns", access_token=access_token, body=body)


async def set_keyword_bid(
    access_token: str, *, keyword_id: int, bid_minor: int
) -> None:
    body = {
        "method": "set",
        "params": {
            "KeywordBids": [{"KeywordId": keyword_id, "Bid": bid_minor}]
        },
    }
    await _post("bids", access_token=access_token, body=body)


async def pause_keyword(access_token: str, *, keyword_id: int) -> None:
    body = {"method": "suspend", "params": {"SelectionCriteria": {"Ids": [keyword_id]}}}
    await _post("keywords", access_token=access_token, body=body)
