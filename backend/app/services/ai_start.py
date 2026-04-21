"""OpenAI-powered ad generator for the START constructor flow.

Unlike `ai_ads.improve_ad` (which rewrites existing copy), this takes a
brief (product, audience, region, keywords, tone) and returns N fresh
ad variants sized for Yandex Direct.

Same failure contract as the rest of the AI layer: any upstream error
(missing key, timeout, bad JSON) returns an empty list — the caller
surfaces that as `generated_count=0` and degrades gracefully.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from openai import AsyncOpenAI, OpenAIError

from app.core.config import get_settings
from app.services.excel_import import HEADLINE_MAX, HEADLINE2_MAX, TEXT_MAX

settings = get_settings()
logger = logging.getLogger("ai_start")

_TIMEOUT_S = 30.0
_MAX_KEYWORDS_IN_PROMPT = 12

_TONE_LABELS: dict[str, str] = {
    "neutral": "нейтральный",
    "friendly": "дружелюбный",
    "confident": "уверенный",
    "premium": "премиальный",
    "playful": "игривый",
}


_SYSTEM_PROMPT = (
    "Ты — senior-копирайтер Яндекс Директа. Ты создаёшь новые объявления "
    "с нуля по брифу клиента: продукт, аудитория, регион, ключевые "
    "фразы, тональность.\n\n"
    "Жёсткие правила:\n"
    f"- headline: строго ≤ {HEADLINE_MAX} символов, по-русски.\n"
    f"- headline2: опционально, ≤ {HEADLINE2_MAX} символов, по-русски.\n"
    f"- text: строго ≤ {TEXT_MAX} символов, по-русски.\n"
    "- Каждое объявление содержит конкретный call-to-action.\n"
    "- Не используй КАПС, не более одного '!', никакой разметки.\n"
    "- Варианты не должны дублировать друг друга — разные УТП и акценты.\n"
    "- В ответе ТОЛЬКО валидный JSON без пояснений вне полей."
)


def _json_shape(n: int) -> str:
    return (
        '{"ads": [{"headline": "строка", "headline2": "строка или null", '
        '"text": "строка", "keywords": ["фраза"], '
        '"reasoning": "1 предложение почему этот вариант сработает"}]}'
        f"  // ровно {n} объектов в массиве"
    )


_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI | None:
    global _client
    if not settings.openai_api_key:
        return None
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key, timeout=_TIMEOUT_S)
    return _client


def _build_user_prompt(brief: dict[str, Any]) -> str:
    tone_key = (brief.get("tone") or "neutral").strip().lower()
    tone_label = _TONE_LABELS.get(tone_key, "нейтральный")
    keywords = brief.get("keywords") or []
    kw_preview = ", ".join(keywords[:_MAX_KEYWORDS_IN_PROMPT]) or "(не заданы)"
    count = int(brief.get("count") or 5)

    lines = [
        f"Продукт / услуга: {brief.get('product') or '(не указан)'}",
        f"Целевая аудитория: {brief.get('audience') or '(не указана)'}",
        f"Регион: {brief.get('region') or '(не указан)'}",
        f"Ключевые фразы: {kw_preview}",
        f"Тональность: {tone_label}",
        f"Сгенерируй ровно {count} разных вариантов объявлений.",
        "",
        f"Верни JSON ровно такой формы: {_json_shape(count)}",
    ]
    return "\n".join(lines)


def _trim(value: str, limit: int) -> str:
    value = (value or "").strip()
    if len(value) <= limit:
        return value
    snippet = value[:limit]
    if " " in snippet:
        snippet = snippet.rsplit(" ", 1)[0]
    return snippet.strip()


def _clean_ad(raw: dict[str, Any]) -> dict[str, Any] | None:
    headline = _trim(str(raw.get("headline") or ""), HEADLINE_MAX)
    text = _trim(str(raw.get("text") or ""), TEXT_MAX)
    if not headline or not text:
        return None

    h2_raw = raw.get("headline2")
    headline2 = _trim(str(h2_raw), HEADLINE2_MAX) if h2_raw else None
    if headline2 == "":
        headline2 = None

    kws_raw = raw.get("keywords") or []
    if isinstance(kws_raw, str):
        kws_raw = [kws_raw]
    keywords = [str(k).strip() for k in kws_raw if str(k).strip()][:20]

    reasoning = str(raw.get("reasoning") or "").strip()

    return {
        "headline": headline,
        "headline2": headline2,
        "text": text,
        "keywords": keywords,
        "reasoning": reasoning,
    }


async def generate_ads(brief: dict[str, Any]) -> list[dict[str, Any]]:
    """Return a list of generated ads (may be empty on any failure)."""
    client = _get_client()
    if client is None:
        return []

    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": _build_user_prompt(brief)},
    ]

    try:
        completion = await client.chat.completions.create(
            model=settings.openai_model,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.7,
            max_tokens=1400,
        )
    except (OpenAIError, asyncio.TimeoutError) as exc:
        logger.warning("ai_start_failed err=%s", exc)
        return []

    raw = (completion.choices[0].message.content or "").strip()
    try:
        data = json.loads(raw)
    except ValueError:
        logger.warning("ai_start_bad_json raw=%r", raw[:200])
        return []

    items = data.get("ads") if isinstance(data, dict) else None
    if not isinstance(items, list):
        return []

    cleaned: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        cleaned_item = _clean_ad(item)
        if cleaned_item is not None:
            cleaned.append(cleaned_item)

    return cleaned
