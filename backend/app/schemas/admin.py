from __future__ import annotations

from pydantic import BaseModel


class FunnelMetricsResponse(BaseModel):
    signups: int
    connectors: int
    activators: int
    payers: int
    revenue_minor: int  # kopecks
    connect_rate: float
    activate_rate: float
    pay_rate: float
