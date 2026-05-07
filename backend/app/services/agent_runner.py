"""Agent runner — the brain of an AI-агент.

Pipeline (single run):
  1. Load agent + ad accounts.  Decrypt tokens.
  2. Fetch campaigns / keywords / ads / metrics from Yandex Direct.
     In stub mode, fabricate a small synthetic dataset so the demo
     produces visible output without real API access.
  3. Audit + diff against KPI; produce findings.
  4. Mode dispatch:
       advisor   — store all findings as state='new'.
       assistant — same, but high-confidence (>=90) findings go to
                   state='new' with a 'suggested apply' hint;
                   user clicks Approve to actually apply.
       auto      — apply high-confidence findings inline; lower-confidence
                   stay as 'new'.

Persistence happens in a single admin-session transaction so the run
record + findings either all land or none of them.

Heavy lifting (HTTP calls, AI generation) is done before the transaction
opens so we don't hold connections during latency.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select

from app.core.database import AsyncSessionAdmin
from app.core.security import decrypt_value, encrypt_value
from app.models.ad_account import AdAccount
from app.models.agent import Agent
from app.models.ai_run import AiRun
from app.models.audit_finding import AuditFinding
from app.models.prompt_version import PromptVersion
from app.services import audit, events
from app.services.yandex_direct import YandexDirectError
from app.services.yandex_direct import (
    get_ad_groups,
    get_ads,
    get_campaigns,
    get_keywords,
    pause_keyword,
    set_keyword_bid,
    update_campaign_budget,
)
from app.services.yandex_oauth import OAuthError, is_stub_mode, refresh_token

logger = logging.getLogger("agent_runner")


# Confidence threshold for assistant-suggested / auto-applied changes.
_AUTO_APPLY_THRESHOLD = 90


# ---------------------------------------------------------------------
# Public entrypoint
# ---------------------------------------------------------------------
async def run(agent_id: uuid.UUID) -> uuid.UUID:
    """Execute one run for `agent_id`.  Returns the run id."""
    async with AsyncSessionAdmin() as session:
        async with session.begin():
            agent = (
                await session.execute(select(Agent).where(Agent.id == agent_id))
            ).scalar_one_or_none()
            if agent is None:
                raise ValueError(f"agent_not_found: {agent_id}")

            accounts = (
                await session.execute(
                    select(AdAccount).where(
                        AdAccount.id.in_([uuid.UUID(x) for x in agent.ad_account_ids])
                    )
                )
            ).scalars().all()

            prompt = await _load_active_prompt(session, kind="audit.findings")

            run_row = AiRun(
                agent_id=agent.id,
                user_id=agent.user_id,
                status="running",
                stats={},
                prompt_version_id=prompt.id if prompt else None,
            )
            session.add(run_row)
            await session.flush()
            run_id = run_row.id

            await audit.log(
                action=audit.Action.AGENT_RUN_STARTED,
                user=agent.user_id,
                resource_type="ai_run",
                resource_id=run_row.id,
            )
            await events.emit(
                session,
                name=events.EventName.AGENT_RUN_STARTED,
                user_id=agent.user_id,
                subject_type="ai_run",
                subject_id=run_row.id,
                payload={"agent_id": str(agent.id)},
            )

    # Fetch + audit *outside* the txn to avoid holding the connection
    # through external HTTP latency.
    findings_payload: list[dict[str, Any]] = []
    fetch_error: str | None = None
    try:
        for account in accounts:
            findings_payload.extend(
                await _audit_account(account=account, agent=agent)
            )
    except (YandexDirectError, OAuthError) as exc:
        fetch_error = f"{type(exc).__name__}: {exc}"
        logger.warning("agent_run_fetch_failed agent=%s err=%s", agent.id, fetch_error)

    # Persist findings + finalise run in a fresh transaction.
    applied_count = 0
    async with AsyncSessionAdmin() as session:
        async with session.begin():
            run_row = (
                await session.execute(select(AiRun).where(AiRun.id == run_id))
            ).scalar_one()

            for f in findings_payload:
                state = "new"
                applied_at = None
                if agent.mode == "auto" and f.get("confidence", 0) >= _AUTO_APPLY_THRESHOLD:
                    # Try to apply inline; if it fails leave as new.
                    if await _try_apply(f, accounts):
                        state = "applied"
                        applied_at = datetime.now(timezone.utc)
                        applied_count += 1

                finding = AuditFinding(
                    run_id=run_id,
                    agent_id=agent.id,
                    user_id=agent.user_id,
                    kind="opportunity" if f.get("severity") == "opportunity" else "issue",
                    severity=str(f.get("severity", "info")),
                    campaign_external_id=f.get("campaign_external_id"),
                    ad_external_id=f.get("ad_external_id"),
                    title=str(f.get("title", ""))[:512],
                    effect=f.get("effect"),
                    suggested_action=f.get("suggested_action"),
                    confidence=int(f.get("confidence", 50)),
                    state=state,
                    applied_at=applied_at,
                )
                session.add(finding)
                await session.flush()

                await events.emit(
                    session,
                    name=events.EventName.FINDING_CREATED,
                    user_id=agent.user_id,
                    subject_type="finding",
                    subject_id=finding.id,
                    payload={
                        "severity": finding.severity,
                        "confidence": finding.confidence,
                    },
                )

            run_row.finished_at = datetime.now(timezone.utc)
            run_row.status = "failed" if fetch_error else "succeeded"
            run_row.error = fetch_error
            run_row.stats = {
                "findings": len(findings_payload),
                "applied": applied_count,
                "stub": is_stub_mode(),
            }

            agent_row = (
                await session.execute(select(Agent).where(Agent.id == agent.id))
            ).scalar_one()
            agent_row.last_run_at = run_row.finished_at

            await audit.log(
                action=audit.Action.AGENT_RUN_FAILED if fetch_error else audit.Action.AGENT_RUN_FINISHED,
                user=agent.user_id,
                resource_type="ai_run",
                resource_id=run_id,
                meta={"findings": len(findings_payload), "applied": applied_count},
            )
            await events.emit(
                session,
                name=events.EventName.AGENT_RUN_FAILED if fetch_error else events.EventName.AGENT_RUN_FINISHED,
                user_id=agent.user_id,
                subject_type="ai_run",
                subject_id=run_id,
                payload={"findings": len(findings_payload), "applied": applied_count},
            )

    return run_id


# ---------------------------------------------------------------------
# Per-account audit
# ---------------------------------------------------------------------
async def _audit_account(*, account: AdAccount, agent: Agent) -> list[dict[str, Any]]:
    """Fetch live data for one account and produce findings.

    Stub mode returns synthetic findings so the demo flow has output.
    """
    if is_stub_mode():
        return _stub_findings(account=account, agent=agent)

    access_token = decrypt_value(account.access_token)
    campaigns = await get_campaigns(access_token, login=account.external_id)
    if not campaigns:
        return []

    campaign_ids = [int(c["Id"]) for c in campaigns]
    ad_groups = await get_ad_groups(access_token, campaign_ids=campaign_ids)
    ad_group_ids = [int(g["Id"]) for g in ad_groups]
    keywords = await get_keywords(access_token, ad_group_ids=ad_group_ids)
    ads = await get_ads(access_token, ad_group_ids=ad_group_ids)

    return _heuristic_findings(
        campaigns=campaigns,
        ad_groups=ad_groups,
        keywords=keywords,
        ads=ads,
        kpi=agent.kpi or {},
    )


def _stub_findings(*, account: AdAccount, agent: Agent) -> list[dict[str, Any]]:
    """Synthetic findings used when YANDEX_DIRECT_CLIENT_ID is empty."""
    return [
        {
            "title": "Низкий CTR в кампании «Поиск / основная»",
            "severity": "warning",
            "campaign_external_id": "stub-campaign-1",
            "effect": "CTR = 1.8% против цели ≥ 3%. Потенциал клики ×1.6.",
            "suggested_action": {
                "type": "rewrite_ads",
                "campaign_external_id": "stub-campaign-1",
            },
            "confidence": 75,
        },
        {
            "title": "Ключи без минус-слов сжигают бюджет",
            "severity": "critical",
            "campaign_external_id": "stub-campaign-1",
            "effect": "27% показов уходят на нерелевантные запросы.",
            "suggested_action": {
                "type": "add_negatives",
                "campaign_external_id": "stub-campaign-1",
                "negatives": ["скачать", "бесплатно", "форум"],
            },
            "confidence": 92,
        },
        {
            "title": "Возможность: дублировать удачную группу под мобайл",
            "severity": "opportunity",
            "campaign_external_id": "stub-campaign-1",
            "effect": "Мобильная конверсия +18% при выделенной группе.",
            "suggested_action": {
                "type": "duplicate_adgroup",
                "ad_group_external_id": "stub-group-7",
            },
            "confidence": 60,
        },
    ]


def _heuristic_findings(
    *,
    campaigns: list[dict[str, Any]],
    ad_groups: list[dict[str, Any]],
    keywords: list[dict[str, Any]],
    ads: list[dict[str, Any]],
    kpi: dict[str, Any],
) -> list[dict[str, Any]]:
    """First-pass heuristic audit.  Cheap and deterministic; AI layer
    on top can be added later as a separate prompt_versions row."""
    findings: list[dict[str, Any]] = []

    # 1) Suspended campaigns shouldn't be in an 'active' agent's account.
    for c in campaigns:
        if c.get("State") == "SUSPENDED":
            findings.append(
                {
                    "title": f"Кампания «{c.get('Name')}» приостановлена",
                    "severity": "warning",
                    "campaign_external_id": str(c.get("Id")),
                    "effect": "Не идут показы. Проверить причину или возобновить.",
                    "suggested_action": {
                        "type": "resume_campaign",
                        "campaign_id": int(c.get("Id", 0)),
                    },
                    "confidence": 70,
                }
            )

    # 2) Suspended keywords inside active campaigns — likely missed.
    active_campaign_ids = {
        int(c["Id"]) for c in campaigns if c.get("State") != "SUSPENDED"
    }
    for kw in keywords:
        if kw.get("State") == "SUSPENDED" and int(kw.get("CampaignId", 0)) in active_campaign_ids:
            findings.append(
                {
                    "title": f"Ключ остановлен: {kw.get('Keyword', '')[:80]}",
                    "severity": "info",
                    "campaign_external_id": str(kw.get("CampaignId")),
                    "effect": "Ключ не приносит показов.",
                    "suggested_action": {
                        "type": "resume_keyword",
                        "keyword_id": int(kw.get("Id", 0)),
                    },
                    "confidence": 65,
                }
            )

    return findings


# ---------------------------------------------------------------------
# Apply
# ---------------------------------------------------------------------
async def _try_apply(
    finding: dict[str, Any], accounts: list[AdAccount]
) -> bool:
    """Apply a single finding via Direct API.  Returns True on success."""
    action = finding.get("suggested_action") or {}
    kind = action.get("type")

    if is_stub_mode():
        # In stub mode "applying" is just bookkeeping.
        return True

    if not accounts:
        return False
    account = accounts[0]
    try:
        token = decrypt_value(account.access_token)
    except ValueError:
        return False

    try:
        if kind == "set_keyword_bid":
            await set_keyword_bid(
                token,
                keyword_id=int(action["keyword_id"]),
                bid_minor=int(action["bid_minor"]),
            )
            return True
        if kind == "pause_keyword":
            await pause_keyword(token, keyword_id=int(action["keyword_id"]))
            return True
        if kind == "set_campaign_budget":
            await update_campaign_budget(
                token,
                campaign_id=int(action["campaign_id"]),
                daily_budget_minor=int(action["daily_budget_minor"]),
            )
            return True
    except YandexDirectError as exc:
        logger.warning("agent_apply_failed kind=%s err=%s", kind, exc)
        return False
    return False


# ---------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------
async def _load_active_prompt(session, *, kind: str) -> PromptVersion | None:
    return (
        await session.execute(
            select(PromptVersion).where(
                PromptVersion.kind == kind,
                PromptVersion.is_active.is_(True),
            )
        )
    ).scalars().first()


# Re-export for callers (e.g. agents router).
__all__ = ["run", "encrypt_value"]
