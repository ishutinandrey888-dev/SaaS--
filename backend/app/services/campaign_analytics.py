"""Roll per-ad audits up to per-campaign analytics + recommendations.

Pure-Python aggregator: no DB, no external calls.  Inputs are the
parsed `ads` (from excel_import) zipped with their `audits` (from
audit_ads); output is one `CampaignAnalytics` per distinct campaign
name.  The frontend uses this to surface high-leverage advice
("замените 40% объявлений", "добавьте ключи в заголовки") instead of
making the user infer them from the per-ad list.

Recommendation thresholds are deliberately coarse — these are
conversation starters, not statistical claims.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any

WEAK_SCORE = 60
ISSUE_SHARE_TRIGGER = 0.30  # an issue must affect ≥30% of ads to surface

_ISSUE_HUMAN: dict[str, str] = {
    "headline_empty": "Пустой заголовок",
    "headline_too_long": "Заголовок длиннее лимита",
    "headline_too_short": "Слишком короткий заголовок",
    "headline2_too_long": "Второй заголовок длиннее лимита",
    "text_empty": "Пустой текст",
    "text_too_long": "Текст длиннее лимита",
    "text_too_short": "Слишком короткий текст",
    "keyword_not_in_headline": "Ключ не вставлен в заголовок",
    "no_cta": "Нет призыва к действию",
    "no_specifics": "Нет конкретики (цен, сроков, цифр)",
    "too_much_uppercase": "Слишком много КАПСА",
    "too_many_exclamations": "Перебор с восклицаниями",
}

# Recommendation copy keyed off issue keys that hit the share threshold.
# Ordered by priority — first match wins for "primary" recommendation.
_REC_BY_ISSUE: list[tuple[str, str]] = [
    ("headline_empty", "Заполните заголовки — без них объявления не показываются."),
    ("text_empty", "Заполните текст объявлений."),
    ("keyword_not_in_headline", "Добавьте ключевые фразы в заголовки — это +15-30% к CTR."),
    ("no_cta", "Добавьте призыв к действию (купить, заказать, получить)."),
    ("no_specifics", "Добавьте конкретику: цены, сроки, цифры."),
    ("headline_too_short", "Используйте полный лимит заголовка (56 символов)."),
    ("text_too_short", "Раскройте оффер подробнее — текст ≥ 40 символов."),
    ("too_much_uppercase", "Уменьшите долю КАПСА — модерация Директа блокирует такие объявления."),
    ("too_many_exclamations", "Оставьте максимум один восклицательный знак."),
    ("headline_too_long", "Сократите заголовки до 56 символов."),
    ("text_too_long", "Сократите тексты до 81 символа."),
]


def _campaign_tone(weak_pct: int, avg: float) -> str:
    if avg >= 80 and weak_pct < 15:
        return "good"
    if avg >= 65 and weak_pct < 35:
        return "warn"
    return "bad"


def _replace_recommendation(weak_pct: int) -> str | None:
    """Top-line action: replace N% of ads when the campaign is weak."""
    if weak_pct >= 60:
        return f"Замените {weak_pct}% слабых объявлений — почти весь трафик уходит впустую."
    if weak_pct >= 40:
        return f"Замените {weak_pct}% слабых объявлений — они тянут CTR кампании вниз."
    if weak_pct >= 20:
        return f"Перепишите {weak_pct}% слабых объявлений — это самое быстрое улучшение."
    return None


def _build_recommendations(
    weak_pct: int,
    issue_counter: Counter[str],
    ads_count: int,
    avg_score: float,
) -> list[str]:
    recs: list[str] = []
    repl = _replace_recommendation(weak_pct)
    if repl:
        recs.append(repl)

    # Issue-driven recs in priority order.
    threshold = max(1, int(ads_count * ISSUE_SHARE_TRIGGER))
    for key, copy in _REC_BY_ISSUE:
        if issue_counter.get(key, 0) >= threshold:
            recs.append(copy)
        if len(recs) >= 3:
            break

    if not recs:
        if avg_score >= 85:
            recs.append("Кампания в хорошей форме — можно тестировать новые офферы.")
        else:
            recs.append("Точечные правки: пройдитесь по самым слабым объявлениям.")
    return recs


def analyze_campaigns(
    ads: list[dict[str, Any]],
    audits: list[dict[str, Any]],
    *,
    improved_flags: list[bool] | None = None,
) -> list[dict[str, Any]]:
    """Return a list of per-campaign analytics dicts, sorted worst-first.

    `improved_flags[i]` is True if `ads[i]` got an AI rewrite — used to
    show "X из Y улучшено" per campaign.
    """
    if len(ads) != len(audits):
        raise ValueError("ads and audits must align")
    if improved_flags is None:
        improved_flags = [False] * len(ads)
    if len(improved_flags) != len(ads):
        raise ValueError("improved_flags must align with ads")

    by_name: dict[str, dict[str, Any]] = defaultdict(
        lambda: {
            "scores": [],
            "issues": Counter(),
            "groups": set(),
            "improved": 0,
        }
    )

    for ad, audit, was_improved in zip(ads, audits, improved_flags):
        name = (ad.get("campaign") or "").strip() or "(без названия)"
        bucket = by_name[name]
        bucket["scores"].append(int(audit.get("score", 0)))
        bucket["issues"].update(audit.get("issues") or [])
        group = (ad.get("group") or "").strip()
        if group:
            bucket["groups"].add(group)
        if was_improved:
            bucket["improved"] += 1

    out: list[dict[str, Any]] = []
    for name, bucket in by_name.items():
        scores: list[int] = bucket["scores"]
        ads_count = len(scores)
        avg_score = round(sum(scores) / ads_count, 1) if ads_count else 0.0
        weak = sum(1 for s in scores if s < WEAK_SCORE)
        weak_pct = int(round(weak * 100 / ads_count)) if ads_count else 0

        issue_counter: Counter[str] = bucket["issues"]
        top_issues = [
            {"key": key, "label": _ISSUE_HUMAN.get(key, key), "count": count}
            for key, count in issue_counter.most_common(3)
        ]

        recs = _build_recommendations(weak_pct, issue_counter, ads_count, avg_score)

        out.append(
            {
                "name": name,
                "groups": sorted(bucket["groups"]),
                "ads_count": ads_count,
                "improved_count": bucket["improved"],
                "avg_score": avg_score,
                "weak_ads_percent": weak_pct,
                "top_issues": top_issues,
                "recommendations": recs,
                "tone": _campaign_tone(weak_pct, avg_score),
            }
        )

    # Worst campaigns first — that's what the user should look at.
    out.sort(key=lambda c: (c["avg_score"], -c["weak_ads_percent"]))
    return out
