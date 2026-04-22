"""Unit tests for FunnelMetrics rate computations."""

from __future__ import annotations

from app.services.metrics import FunnelMetrics, funnel_to_dict


def test_rates_happy_path():
    m = FunnelMetrics(signups=100, uploaders=50, improvers=20, payers=5, revenue_minor=12345)
    assert m.upload_rate == 0.5
    assert m.improve_rate == 0.4
    assert m.pay_rate == 0.25


def test_rates_zero_denominator_safe():
    m = FunnelMetrics(signups=0, uploaders=0, improvers=0, payers=0, revenue_minor=0)
    assert m.upload_rate == 0.0
    assert m.improve_rate == 0.0
    assert m.pay_rate == 0.0


def test_funnel_to_dict_rounds_rates():
    m = FunnelMetrics(signups=3, uploaders=1, improvers=0, payers=0, revenue_minor=0)
    out = funnel_to_dict(m)
    assert out["upload_rate"] == round(1 / 3, 4)
    assert out["revenue_minor"] == 0
