"""Unit tests for FunnelMetrics rate computations."""

from __future__ import annotations

from app.services.metrics import FunnelMetrics, funnel_to_dict


def test_rates_happy_path():
    m = FunnelMetrics(signups=100, connectors=50, activators=20, payers=5, revenue_minor=12345)
    assert m.connect_rate == 0.5
    assert m.activate_rate == 0.4
    assert m.pay_rate == 0.25


def test_rates_zero_denominator_safe():
    m = FunnelMetrics(signups=0, connectors=0, activators=0, payers=0, revenue_minor=0)
    assert m.connect_rate == 0.0
    assert m.activate_rate == 0.0
    assert m.pay_rate == 0.0


def test_funnel_to_dict_rounds_rates():
    m = FunnelMetrics(signups=3, connectors=1, activators=0, payers=0, revenue_minor=0)
    out = funnel_to_dict(m)
    assert out["connect_rate"] == round(1 / 3, 4)
    assert out["revenue_minor"] == 0
