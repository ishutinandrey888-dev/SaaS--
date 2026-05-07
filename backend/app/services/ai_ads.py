"""OpenAI-powered ad copy rewriter.

Single-shot improvement: given the original ad + keywords, return a
rewritten headline and text that respect Yandex Direct length caps.

Failure modes (missing API key, upstream timeout, malformed JSON) are
swallowed and surfaced as `None` — the caller shows the original ad in
that case and keeps the rest of the response usable.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from openai import AsyncOpenAI, OpenAIError

from app.core.config import get_settings
from app.core.limits import HEADLINE_MAX, TEXT_MAX

settings = get_settings()
logger = logging.getLogger("ai_ads")

_TIMEOUT_S = 20.0
_MAX_KEYWORDS_IN_PROMPT = 8

_SYSTEM_PROMPT = (
    "Ты — senior-копирайтер Яндекс Директа. Ты переписываешь объявления "
    "так, чтобы они были релевантны ключевым фразам, содержали призыв к "
    "действию и не превышали лимиты платформы.\n\n"
    f"Жёсткие правила:\n"
    f"- headline: строго ≤ {HEADLINE_MAX} символов, по-русски.\n"
    f"- text: строго ≤ {TEXT_MAX} символов, по-русски.\n"
    "- Не используй КАПС, не более одного '!', никакой разметки.\n"
    "- Сохраняй смысл оригинала, но усиливай конкретику и CTA.\n"
    "- В ответе ТОЛЬКО валидный JSON без пояснений вне полей."
)

_JSON_SHAPE = (
    '{"headline": "строка", "text": "строка", "reasoning": "1-2 предложения '
    "почему новая версия сильнее — по-русски\"}"
)


_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI | None:
    global _client
    if not settings.openai_api_key:
        return None
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key, timeout=_TIMEOUT_S)
    return _client


def _build_user_prompt(ad: dict[str, Any]) -> str:
    headline = (ad.get("headline") or "").strip() or "(нет)"
    headline2 = (ad.get("headline2") or "").strip()
    text = (ad.get("text") or "").strip() or "(нет)"
    keywords = ad.get("keywords") or []
    campaign = (ad.get("campaign") or "").strip()
    group = (ad.get("group") or "").strip()

    kw_preview = ", ".join(keywords[:_MAX_KEYWORDS_IN_PROMPT]) or "(не заданы)"

    lines = [
        f"Кампания: {campaign or '(неизвестно)'}",
        f"Группа: {group or '(неизвестно)'}",
        f"Ключевые фразы: {kw_preview}",
        f"Текущий заголовок: {headline}",
    ]
    if headline2:
        lines.append(f"Текущий второй заголовок: {headline2}")
    lines.append(f"Текущий текст: {text}")
    lines.append("")
    lines.append(f"Верни JSON ровно такой формы: {_JSON_SHAPE}")
    return "\n".join(lines)


def _trim(value: str, limit: int) -> str:
    value = (value or "").strip()
    if len(value) <= limit:
        return value
    # Cut on a word boundary if possible.
    snippet = value[:limit]
    if " " in snippet:
        snippet = snippet.rsplit(" ", 1)[0]
    return snippet.strip()


async def improve_ad(ad: dict[str, Any]) -> dict[str, Any] | None:
    """Return a rewritten ad or None if the model is unavailable/failed."""
    client = _get_client()
    if client is None:
        return None

    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": _build_user_prompt(ad)},
    ]

    try:
        completion = await client.chat.completions.create(
            model=settings.openai_model,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.5,
            max_tokens=400,
        )
    except (OpenAIError, asyncio.TimeoutError) as exc:
        logger.warning("ai_improve_failed row=%s err=%s", ad.get("row"), exc)
        return None

    raw = (completion.choices[0].message.content or "").strip()
    try:
        data = json.loads(raw)
    except ValueError:
        logger.warning("ai_improve_bad_json row=%s raw=%r", ad.get("row"), raw[:200])
        return None

    headline = _trim(str(data.get("headline") or ""), HEADLINE_MAX)
    text = _trim(str(data.get("text") or ""), TEXT_MAX)
    reasoning = str(data.get("reasoning") or "").strip()

    if not headline or not text:
        return None

    return {"headline": headline, "text": text, "reasoning": reasoning}
