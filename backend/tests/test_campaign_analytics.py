"""Unit tests for campaign-level analytics aggregator."""

from __future__ import annotations

from app.services.campaign_analytics import (
    WEAK_SCORE,
    analyze_campaigns,
)


def _ad(*, row: int, campaign: str, group: str = "g1", headline: str = "h"):
    return {
        "row": row,
        "campaign": campaign,
        "group": group,
        "headline": headline,
        "headline2": None,
        "text": "t",
        "keywords": [],
    }


def _audit(*, score: int, issues: list[str] | None = None):
    return {
        "score": score,
        "issues": issues or [],
        "suggestions": [],
    }


def test_analyze_campaigns_groups_by_name():
    ads = [
        _ad(row=2, campaign="A", group="g1"),
        _ad(row=3, campaign="A", group="g2"),
        _ad(row=4, campaign="B", group="gx"),
    ]
    audits = [_audit(score=80), _audit(score=70), _audit(score=50)]
    out = analyze_campaigns(ads, audits)
    by_name = {c["name"]: c for c in out}
    assert set(by_name.keys()) == {"A", "B"}
    assert by_name["A"]["ads_count"] == 2
    assert by_name["A"]["groups"] == ["g1", "g2"]
    assert by_name["B"]["ads_count"] == 1


def test_analyze_campaigns_avg_and_weak_pct():
    ads = [_ad(row=i, campaign="A") for i in range(4)]
    audits = [
        _audit(score=90),
        _audit(score=80),
        _audit(score=40),  # weak
        _audit(score=20),  # weak
    ]
    out = analyze_campaigns(ads, audits)
    assert len(out) == 1
    c = out[0]
    assert c["avg_score"] == 57.5
    assert c["weak_ads_percent"] == 50
    assert c["tone"] == "bad"


def test_empty_campaign_name_uses_placeholder():
    ads = [_ad(row=1, campaign="")]
    audits = [_audit(score=60)]
    out = analyze_campaigns(ads, audits)
    assert out[0]["name"] == "(без названия)"


def test_weak_score_threshold_boundary():
    ads = [_ad(row=i, campaign="A") for i in range(2)]
    # WEAK_SCORE itself is NOT weak (uses < operator)
    audits = [_audit(score=WEAK_SCORE), _audit(score=WEAK_SCORE - 1)]
    out = analyze_campaigns(ads, audits)
    assert out[0]["weak_ads_percent"] == 50


def test_top_issues_capped_to_three_and_humanized():
    ads = [_ad(row=i, campaign="A") for i in range(5)]
    audits = [
        _audit(score=30, issues=["headline_empty", "text_empty"]),
        _audit(score=30, issues=["headline_empty", "no_cta"]),
        _audit(score=30, issues=["headline_empty", "no_cta", "text_empty"]),
        _audit(score=30, issues=["no_specifics"]),
        _audit(score=30, issues=["too_much_uppercase"]),
    ]
    out = analyze_campaigns(ads, audits)
    issues = out[0]["top_issues"]
    assert len(issues) == 3
    keys = [i["key"] for i in issues]
    assert "headline_empty" in keys
    # Humanised label, not the bare key.
    he = next(i for i in issues if i["key"] == "headline_empty")
    assert he["label"] == "Пустой заголовок"
    assert he["count"] == 3


def test_recommendations_include_replace_when_weak_dominates():
    ads = [_ad(row=i, campaign="A") for i in range(10)]
    # 7/10 weak → 70% → should suggest replacing.
    audits = [_audit(score=20)] * 7 + [_audit(score=90)] * 3
    out = analyze_campaigns(ads, audits)
    recs = out[0]["recommendations"]
    assert recs, "expected at least one recommendation"
    assert "70%" in recs[0]


def test_recommendations_issue_driven_above_threshold():
    # 4/4 ads have keyword_not_in_headline → 100% above 30%.
    ads = [_ad(row=i, campaign="A") for i in range(4)]
    audits = [_audit(score=70, issues=["keyword_not_in_headline"])] * 4
    out = analyze_campaigns(ads, audits)
    recs = out[0]["recommendations"]
    assert any("ключевые фразы" in r.lower() for r in recs)


def test_recommendations_have_fallback_when_clean():
    ads = [_ad(row=i, campaign="A") for i in range(3)]
    audits = [_audit(score=92)] * 3
    out = analyze_campaigns(ads, audits)
    recs = out[0]["recommendations"]
    assert recs  # never empty
    assert "хорошей форме" in recs[0]


def test_recommendations_fallback_when_mid_score_no_issues():
    ads = [_ad(row=i, campaign="A") for i in range(3)]
    audits = [_audit(score=70)] * 3
    out = analyze_campaigns(ads, audits)
    recs = out[0]["recommendations"]
    assert recs
    assert "слабым" in recs[0].lower()


def test_tone_thresholds():
    ads = [_ad(row=i, campaign="A") for i in range(2)]
    out = analyze_campaigns(ads, [_audit(score=90), _audit(score=85)])
    assert out[0]["tone"] == "good"

    out = analyze_campaigns(ads, [_audit(score=70), _audit(score=70)])
    assert out[0]["tone"] == "warn"

    out = analyze_campaigns(ads, [_audit(score=30), _audit(score=30)])
    assert out[0]["tone"] == "bad"


def test_sort_worst_first():
    ads = [
        _ad(row=1, campaign="Good"),
        _ad(row=2, campaign="Bad"),
        _ad(row=3, campaign="Mid"),
    ]
    audits = [_audit(score=90), _audit(score=20), _audit(score=60)]
    out = analyze_campaigns(ads, audits)
    assert [c["name"] for c in out] == ["Bad", "Mid", "Good"]


def test_improved_flags_counted_per_campaign():
    ads = [
        _ad(row=1, campaign="A"),
        _ad(row=2, campaign="A"),
        _ad(row=3, campaign="B"),
    ]
    audits = [_audit(score=40), _audit(score=40), _audit(score=40)]
    out = analyze_campaigns(
        ads, audits, improved_flags=[True, False, True]
    )
    by_name = {c["name"]: c for c in out}
    assert by_name["A"]["improved_count"] == 1
    assert by_name["B"]["improved_count"] == 1


def test_misaligned_inputs_raise():
    ads = [_ad(row=1, campaign="A")]
    audits = [_audit(score=50), _audit(score=60)]
    try:
        analyze_campaigns(ads, audits)
    except ValueError:
        pass
    else:
        raise AssertionError("expected ValueError")


def test_improved_flags_misalignment_raises():
    ads = [_ad(row=1, campaign="A")]
    audits = [_audit(score=50)]
    try:
        analyze_campaigns(ads, audits, improved_flags=[True, False])
    except ValueError:
        pass
    else:
        raise AssertionError("expected ValueError")
