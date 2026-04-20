from __future__ import annotations

import io

import pytest
from openpyxl import Workbook

from app.services.excel_import import _parse_workbook_bytes


def _xlsx_bytes(rows: list[list[str]]) -> bytes:
    wb = Workbook()
    ws = wb.active
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_parses_minimal_direct_sheet():
    data = _xlsx_bytes([
        ["Название кампании", "Название группы", "Заголовок 1", "Текст", "Ключевые фразы"],
        ["Кампания 1", "Группа A", "Купить iPhone 15", "Закажите сегодня — доставка 1 день.", "iphone 15, купить iphone"],
        ["",            "",         "Новый Samsung S24", "Заказ за 2 клика — скидка 15%.",    "samsung s24"],
    ])
    result = _parse_workbook_bytes(data)

    assert len(result["ads"]) == 2
    assert result["errors"] == []
    # Campaign/group fall-through from the first row:
    assert result["ads"][1]["campaign"] == "Кампания 1"
    assert result["ads"][1]["group"] == "Группа A"
    # Keyword splitting handles both commas and newlines:
    assert "iphone 15" in result["ads"][0]["keywords"]
    assert "купить iphone" in result["ads"][0]["keywords"]


def test_collects_errors_without_raising():
    long_headline = "Слишком длинный заголовок " * 5  # > 56
    data = _xlsx_bytes([
        ["Кампания", "Группа", "Заголовок 1", "Текст"],
        ["К",         "Г",      long_headline,  "Ок текст."],
        ["К",         "Г",      "",             "Текст без заголовка."],
    ])
    result = _parse_workbook_bytes(data)

    assert len(result["ads"]) == 2
    # Row 2: too_long headline; row 3: empty headline.
    fields = {(e["row"], e["field"]) for e in result["errors"]}
    assert (2, "headline") in fields
    assert (3, "headline") in fields


def test_missing_required_columns_returns_single_error():
    data = _xlsx_bytes([["foo", "bar"], ["a", "b"]])
    result = _parse_workbook_bytes(data)
    assert result["ads"] == []
    assert result["errors"][0]["field"] == "header"


def test_broken_file_is_handled():
    result = _parse_workbook_bytes(b"not a real xlsx")
    assert result["ads"] == []
    assert result["errors"][0]["message"].startswith("cannot_open_xlsx")


def test_empty_rows_are_skipped():
    data = _xlsx_bytes([
        ["Название кампании", "Заголовок 1", "Текст"],
        ["", "", ""],
        ["K", "Купить что-то", "Хороший текст с цифрой 2024."],
        ["", "", ""],
    ])
    result = _parse_workbook_bytes(data)
    assert len(result["ads"]) == 1
    assert result["ads"][0]["row"] == 3
