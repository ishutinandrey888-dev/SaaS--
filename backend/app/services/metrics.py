"""Funnel metrics from `audit_logs`.

Computes the four funnel counts the founder cares about:

  signups → uploaders → improvers → payers

We count *distinct user_id* per stage so each user contributes once,
giving meaningful conversion ratios.

Source rows by stage:
  signups    — action = auth.register
  uploaders  — action = excel.upload                  (sync /excel/upload)
              + excel_job_succeeded surrogate         (-- not yet emitted; the
                                                          /excel/jobs path
                                                          relies on its task
                                                          completing.  For
                                                          MVP we accept the
                                                          undercount.)
  improvers  — action IN (excel.improve_all, start.generate)
  payers     — action = payment.succeeded

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
    uploaders: int
    improvers: int
    payers: int
    revenue_minor: int  # sum of payments.amount where status=succeeded

    @property
    def upload_rate(self) -> float:
        return self.uploaders / self.signups if self.signups else 0.0

    @property
    def improve_rate(self) -> float:
        return self.improvers / self.uploaders if self.uploaders else 0.0

    @property
    def pay_rate(self) -> float:
        return self.payers / self.improvers if self.improvers else 0.0


_FUNNEL_SQL = text(
    """
    WITH stages AS (
        SELECT
            COUNT(DISTINCT user_id) FILTER (
                WHERE action = 'auth.register'
            ) AS signups,
            COUNT(DISTINCT user_id) FILTER (
                WHERE action = 'excel.upload'
            ) AS uploaders,
            COUNT(DISTINCT user_id) FILTER (
                WHERE action IN ('excel.improve_all', 'start.generate')
            ) AS improvers,
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
        s.signups, s.uploaders, s.improvers, s.payers,
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
        uploaders=int(row["uploaders"] or 0),
        improvers=int(row["improvers"] or 0),
        payers=int(row["payers"] or 0),
        revenue_minor=int(row["revenue_minor"] or 0),
    )


def funnel_to_dict(m: FunnelMetrics) -> dict[str, Any]:
    return {
        "signups": m.signups,
        "uploaders": m.uploaders,
        "improvers": m.improvers,
        "payers": m.payers,
        "revenue_minor": m.revenue_minor,
        "upload_rate": round(m.upload_rate, 4),
        "improve_rate": round(m.improve_rate, 4),
        "pay_rate": round(m.pay_rate, 4),
    }
