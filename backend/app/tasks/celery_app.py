"""Celery application.

Broker + result backend both live on the same Redis that already backs
the rate limiter (see `app/middleware/rate_limit.py`).  The worker is
kicked by `deploy/docker-compose.yml` via
`celery -A app.tasks.celery_app worker`, which imports this module and
picks up any task modules listed in `imports`.

Task result TTL is deliberately short (2h) — we expect the frontend to
poll the result immediately, and ad content in the result payload is
ephemeral (not persisted in the DB on purpose).
"""

from __future__ import annotations

import logging

from celery import Celery

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger("celery")

celery_app = Celery(
    "saas_direct",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks.agent_tasks"],
)

celery_app.conf.update(
    task_serializer="pickle",
    result_serializer="pickle",
    accept_content=["pickle", "json"],
    result_expires=2 * 60 * 60,  # 2h
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,
    beat_schedule={
        "agent-runner-tick": {
            "task": "agent.tick",
            "schedule": 5 * 60.0,
        },
    },
)
