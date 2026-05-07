"""Funnel metrics from `audit_logs`.

Computes the four funnel counts the founder cares about for the agent product:

  signups → connectors → activators → payers

We count *distinct user_id* per stage so each user contributes once,
giving meaningful conversion ratios.

Source rows by stage:
  signups     — action = auth.register
  connectors  — action = oauth.yandex.granted
  activators  — action = agent.launched
  payers      — action = payment.succeeded

Results are computed in a single SQL roundtrip; safe to call on every
admin pageview at MVP scale.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True)
class FunnelMetrics:
    signups: int
    connectors: int
    activators: int
    payers: int
    revenue_minor: int

    @property
    def connect_rate(self) -> float:
        return self.connectors / self.signups if self.signups else 0.0

    @property
    def activate_rate(self) -> float:
        return self.activators / self.connectors if self.connectors else 0.0

    @property
    def pay_rate(self) -> float:
        return self.payers / self.activators if self.activators else 0.0


_FUNNEL_SQL = text(
    """
    WITH stages AS (
        SELECT
            COUNT(DISTINCT user_id) FILTER (
                WHERE action = 'auth.register'
            ) AS signups,
            COUNT(DISTINCT user_id) FILTER (
                WHERE action = 'oauth.yandex.granted'
            ) AS connectors,
            COUNT(DISTINCT user_id) FILTER (
                WHERE action = 'agent.launched'
            ) AS activators,
            COUNT(DISTINCT user_id) FILTER (
                WHERE action = 'payment.succeeded'
            ) AS payers
        FROM audit_logs
        WHERE user_id IS NOT NULL
    ),
    revenue AS (
        SELECT COALESCE(SUM(amount), 0) AS revenue_minor
        FROM payments
        WHERE status = 'succeeded'
    )
    SELECT
        s.signups, s.connectors, s.activators, s.payers,
        r.revenue_minor
    FROM stages s, revenue r
    """
)


async def compute_funnel(session: AsyncSession) -> FunnelMetrics:
    res = await session.execute(_FUNNEL_SQL)
    row = res.mappings().first()
    if row is None:
        return FunnelMetrics(0, 0, 0, 0, 0)
    return FunnelMetrics(
        signups=int(row["signups"] or 0),
        connectors=int(row["connectors"] or 0),
        activators=int(row["activators"] or 0),
        payers=int(row["payers"] or 0),
        revenue_minor=int(row["revenue_minor"] or 0),
    )


def funnel_to_dict(m: FunnelMetrics) -> dict[str, Any]:
    return {
        "signups": m.signups,
        "connectors": m.connectors,
        "activators": m.activators,
        "payers": m.payers,
        "revenue_minor": m.revenue_minor,
        "connect_rate": round(m.connect_rate, 4),
        "activate_rate": round(m.activate_rate, 4),
        "pay_rate": round(m.pay_rate, 4),
    }
