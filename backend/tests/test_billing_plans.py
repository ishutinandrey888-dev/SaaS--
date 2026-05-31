"""Sanity tests for the new tariff catalog."""

from __future__ import annotations

from app.services import billing


def test_three_plans_in_catalog():
    assert set(billing.PLANS) == {"free", "pro", "agency"}


def test_pro_price_matches_brief():
    assert billing.PLANS["pro"].price_rub == 5990


def test_agency_price_matches_brief():
    assert billing.PLANS["agency"].price_rub == 19900


def test_token_limits_match_product_model():
    assert billing.PLANS["free"].token_limit == 500
    assert billing.PLANS["pro"].token_limit == 5000
    assert billing.PLANS["agency"].token_limit == 15000


def test_free_is_zero():
    assert billing.PLANS["free"].price_rub == 0


def test_get_plan_unknown_falls_back_to_free():
    assert billing.get_plan("starter").id == "free"
    assert billing.get_plan(None).id == "free"
