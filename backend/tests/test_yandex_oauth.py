"""Yandex OAuth helpers: state JWT round-trip, stub URL, token exchange."""

from __future__ import annotations

import asyncio

from app.services import yandex_oauth


def test_make_and_parse_state_round_trip():
    state = yandex_oauth.make_state("user-1", "project-1")
    assert state and state.count(".") == 2  # JWT shape
    uid, pid = yandex_oauth.parse_state(state)
    assert uid == "user-1"
    assert pid == "project-1"


def test_parse_state_rejects_garbage():
    try:
        yandex_oauth.parse_state("not-a-jwt")
    except yandex_oauth.OAuthError:
        return
    raise AssertionError("expected OAuthError")


def test_authorize_url_in_stub_mode_points_to_callback():
    url = yandex_oauth.authorize_url("STATE")
    assert "stub-code" in url


def test_exchange_code_in_stub_mode_returns_synthetic_bundle():
    bundle = asyncio.run(yandex_oauth.exchange_code("anything"))
    assert bundle.access_token == "stub-access-token"
    assert bundle.external_id == "stub-direct-account"
    assert bundle.refresh_token == "stub-refresh-token"


def test_is_stub_mode_when_credentials_missing():
    assert yandex_oauth.is_stub_mode() is True
