"""Heuristic per-ad quality audit.

No external calls — pure Python string analysis over a single ad dict.
The score is intentionally coarse (0-100 bucketed) so the UI can show a
traffic light without pretending to be more precise than it is.

Ad dict shape (see services.excel_import):
    {
        "headline": str,
        "headline2": str | None,
        "text": str,
        "keywords": list[str],
        ...
    }
"""

from __future__ import annotations

import re
from typing import Any

from app.services.excel_import import HEADLINE_MAX, HEADLINE2_MAX, TEXT_MAX

# Russian + English CTA verbs.  Prefix match on word starts so we cover
# conjugations without listing every form.
_CTA_STEMS = (
    "куп", "заказ", "выбер", "узна", "получ", "скач", "оформ", "попроб",
    "закаж", "перейд", "звон", "подпиш", "получит", "запис", "брон",
    "оставь", "оставьте", "оставит", "пробуй", "начн", "сдел",
    "buy", "order", "try", "get", "learn", "subscribe", "download",
)

_WORD_RE = re.compile(r"[A-Za-zА-Яа-яЁё]{3,}")
_DIGIT_RE = re.compile(r"\d")


def _has_cta(text: str) -> bool:
    low = text.lower()
    return any(stem in low for stem in _CTA_STEMS)


def _normalise(token: str) -> str:
    return re.sub(r"[^a-zа-яё0-9]", "", token.lower())


def _keyword_hit(headline: str, keywords: list[str]) -> bool:
    """True when at least one meaningful token from any keyword phrase
    appears in the headline (case-insensitive, ≥3 letters)."""
    if not keywords or not headline:
        return False
    hn_tokens = {_normalise(t) for t in _WORD_RE.findall(headline) if len(t) >= 3}
    if not hn_tokens:
        return False
    for phrase in keywords:
        for token in _WORD_RE.findall(phrase):
            norm = _normalise(token)
            if norm and norm in hn_tokens:
                return True
    return False


def _uppercase_ratio(text: str) -> float:
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return 0.0
    upper = sum(1 for c in letters if c.isupper())
    return upper / len(letters)


def analyze_ad(ad: dict[str, Any]) -> dict[str, Any]:
    """Return {score, issues, suggestions} for a single parsed ad."""
    headline = (ad.get("headline") or "").strip()
    headline2 = (ad.get("headline2") or "").strip()
    text = (ad.get("text") or "").strip()
    keywords = ad.get("keywords") or []

    issues: list[str] = []
    suggestions: list[str] = []
    score = 100

    # --- Hard structural checks --------------------------------------
    if not headline:
        issues.append("headline_empty")
        suggestions.append("Добавьте заголовок — без него объявление не показывается.")
        score -= 40
    else:
        if len(headline) > HEADLINE_MAX:
            issues.append("headline_too_long")
            suggestions.append(
                f"Сократите заголовок до {HEADLINE_MAX} символов "
                f"(сейчас {len(headline)})."
            )
            score -= 20
        elif len(headline) < 15:
            issues.append("headline_too_short")
            suggestions.append(
                "Используйте больше пространства заголовка — Яндекс Директ "
                f"позволяет до {HEADLINE_MAX} символов."
            )
            score -= 5

    if not text:
        issues.append("text_empty")
        suggestions.append("Добавьте текст объявления.")
        score -= 30
    else:
        if len(text) > TEXT_MAX:
            issues.append("text_too_long")
            suggestions.append(
                f"Сократите текст до {TEXT_MAX} символов (сейчас {len(text)})."
            )
            score -= 15
        elif len(text) < 30:
            issues.append("text_too_short")
            suggestions.append(
                "Раскройте оффер подробнее — CTR выше при тексте ≥ 40 символов."
            )
            score -= 5

    if headline2 and len(headline2) > HEADLINE2_MAX:
        issues.append("headline2_too_long")
        suggestions.append(
            f"Второй заголовок: максимум {HEADLINE2_MAX} символов "
            f"(сейчас {len(headline2)})."
        )
        score -= 5

    # --- Relevance ----------------------------------------------------
    if keywords and headline and not _keyword_hit(headline, keywords):
        issues.append("keyword_not_in_headline")
        suggestions.append(
            "Вставьте ключевую фразу в заголовок — это +15-30% к CTR."
        )
        score -= 15

    # --- Persuasion / CTA --------------------------------------------
    if text and not _has_cta(text) and not _has_cta(headline):
        issues.append("no_cta")
        suggestions.append(
            "Добавьте призыв к действию (купить, заказать, получить, попробовать …)."
        )
        score -= 10

    # --- Specificity --------------------------------------------------
    if text and not _DIGIT_RE.search(text) and not _DIGIT_RE.search(headline):
        issues.append("no_specifics")
        suggestions.append(
            "Добавьте конкретику: цену, срок, гарантию, количество — числа повышают доверие."
        )
        score -= 5

    # --- Tone ---------------------------------------------------------
    joined = f"{headline} {text}"
    if _uppercase_ratio(joined) > 0.3 and sum(1 for c in joined if c.isalpha()) > 10:
        issues.append("too_much_uppercase")
        suggestions.append(
            "Уменьшите долю КАПСА — модерация Директа часто блокирует такие объявления."
        )
        score -= 10

    if text.count("!") >= 3 or headline.count("!") >= 2:
        issues.append("too_many_exclamations")
        suggestions.append("Оставьте максимум один восклицательный знак.")
        score -= 5

    score = max(0, min(100, score))
    return {"score": score, "issues": issues, "suggestions": suggestions}
