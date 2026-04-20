from __future__ import annotations

from app.services.audit_ads import analyze_ad


def test_strong_ad_scores_high():
    result = analyze_ad({
        "headline": "Купите iPhone 15 со скидкой 20% до 30 мая",
        "text": "Закажите сегодня — доставка 1 день, гарантия 2 года.",
        "keywords": ["iphone 15", "купить iphone"],
    })
    assert result["score"] >= 85
    assert result["issues"] == []


def test_empty_ad_is_flagged():
    result = analyze_ad({"headline": "", "text": "", "keywords": []})
    assert result["score"] <= 40
    assert "headline_empty" in result["issues"]
    assert "text_empty" in result["issues"]
    assert any("заголовок" in s.lower() for s in result["suggestions"])


def test_caps_and_exclamations_are_flagged():
    result = analyze_ad({
        "headline": "ЛУЧШИЕ ЦЕНЫ!!",
        "text": "ПОКУПАЙТЕ ПРЯМО СЕЙЧАС!!! ОЧЕНЬ ВЫГОДНО!",
        "keywords": ["iphone"],
    })
    assert "too_much_uppercase" in result["issues"]
    assert "too_many_exclamations" in result["issues"]


def test_missing_keyword_in_headline_is_penalised():
    no_kw = analyze_ad({
        "headline": "Надёжный сервис доставки на 10 лет рынка",
        "text": "Закажите сегодня — приедем за 30 минут. Оплата при получении.",
        "keywords": ["iphone 15"],
    })
    assert "keyword_not_in_headline" in no_kw["issues"]

    with_kw = analyze_ad({
        "headline": "Купить iPhone 15 — быстрая доставка за 30 минут",
        "text": "Закажите сегодня — приедем за 30 минут. Оплата при получении.",
        "keywords": ["iphone 15"],
    })
    assert "keyword_not_in_headline" not in with_kw["issues"]
    assert with_kw["score"] > no_kw["score"]


def test_length_overflow_is_flagged():
    result = analyze_ad({
        "headline": "Заголовок " + "очень " * 20,  # > 56
        "text": "Текст " + "супер " * 20,          # > 81
        "keywords": ["test"],
    })
    assert "headline_too_long" in result["issues"]
    assert "text_too_long" in result["issues"]
