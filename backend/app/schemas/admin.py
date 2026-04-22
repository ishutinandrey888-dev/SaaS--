from __future__ import annotations

from pydantic import BaseModel


class FunnelMetricsResponse(BaseModel):
    signups: int
    uploaders: int
    improvers: int
    payers: int
    revenue_minor: int  # kopecks
    upload_rate: float
    improve_rate: float
    pay_rate: float
