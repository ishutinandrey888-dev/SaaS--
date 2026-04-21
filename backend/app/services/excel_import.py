"""Yandex Direct XLSX parser.

Yandex "XLS Master" templates place ads and their parent campaign/group
on the same row.  We read what we need (campaign name, group name,
headline, second headline, ad text, keywords) and drop everything else.

Parsing never raises: row-level problems are collected into `errors`
so the caller can show them next to the audit result.
"""

from __future__ import annotations

import asyncio
import io
from typing import Any

from fastapi import UploadFile
from openpyxl import load_workbook

# Yandex Direct ad copy limits (chars).
HEADLINE_MAX = 56
HEADLINE2_MAX = 30
TEXT_MAX = 81

# Alias tables.  Keys are lowercased, normalised header substrings.
_HEADER_ALIASES: dict[str, tuple[str, ...]] = {
    "campaign": ("название кампании", "кампания"),
    "group": ("название группы", "группа объявлений", "группа"),
    "headline": ("заголовок 1", "заголовок"),
    "headline2": ("заголовок 2", "дополнительный заголовок"),
    "text": ("текст объявления", "текст"),
    "keywords": ("ключевые фразы", "ключевая фраза", "ключевые слова", "фразы"),
}

_MAX_ROWS = 5_000  # hard cap to bound memory / latency on pathological files


def _norm_header(value: Any) -> str:
    return str(value or "").strip().lower()


def _build_column_map(header_row: tuple[Any, ...]) -> dict[str, int]:
    """Return {logical_name: column_index}. Missing columns are omitted."""
    normalised = [_norm_header(v) for v in header_row]
    mapping: dict[str, int] = {}
    for logical, aliases in _HEADER_ALIASES.items():
        for idx, cell in enumerate(normalised):
            if any(alias in cell for alias in aliases):
                mapping[logical] = idx
                break
    return mapping


def _cell(row: tuple[Any, ...], idx: int | None) -> str:
    if idx is None or idx >= len(row):
        return ""
    value = row[idx]
    if value is None:
        return ""
    return str(value).strip()


def _split_keywords(raw: str) -> list[str]:
    if not raw:
        return []
    parts: list[str] = []
    for chunk in raw.replace(";", "\n").replace(",", "\n").splitlines():
        token = chunk.strip()
        if token:
            parts.append(token)
    return parts


def _parse_workbook_bytes(data: bytes) -> dict[str, Any]:
    errors: list[dict[str, Any]] = []
    try:
        workbook = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    except Exception as exc:  # openpyxl raises various types for broken files
        return {
            "campaigns": [],
            "ads": [],
            "errors": [{"row": 0, "field": "file", "message": f"cannot_open_xlsx: {exc}"}],
        }

    sheet = workbook.active
    if sheet is None:
        return {
            "campaigns": [],
            "ads": [],
            "errors": [{"row": 0, "field": "file", "message": "no_active_sheet"}],
        }

    rows = sheet.iter_rows(values_only=True)
    try:
        header = next(rows)
    except StopIteration:
        return {"campaigns": [], "ads": [], "errors": [
            {"row": 0, "field": "file", "message": "empty_sheet"}
        ]}

    cols = _build_column_map(header)
    if "headline" not in cols or "text" not in cols:
        return {
            "campaigns": [],
            "ads": [],
            "errors": [{
                "row": 1,
                "field": "header",
                "message": "required_columns_missing: need 'Заголовок' and 'Текст'",
            }],
        }

    campaigns: dict[str, dict[str, Any]] = {}
    ads: list[dict[str, Any]] = []
    last_campaign = ""
    last_group = ""

    for offset, row in enumerate(rows, start=2):  # +2 because header=1
        if offset - 1 > _MAX_ROWS:
            errors.append({
                "row": offset,
                "field": "file",
                "message": f"row_limit_exceeded: only first {_MAX_ROWS} rows parsed",
            })
            break

        campaign = _cell(row, cols.get("campaign")) or last_campaign
        group = _cell(row, cols.get("group")) or last_group
        headline = _cell(row, cols.get("headline"))
        headline2 = _cell(row, cols.get("headline2"))
        text = _cell(row, cols.get("text"))
        keywords_raw = _cell(row, cols.get("keywords"))

        if campaign:
            last_campaign = campaign
        if group:
            last_group = group

        # Skip rows with no ad-ish content at all.
        if not any([headline, headline2, text, keywords_raw]):
            continue

        row_errors: list[dict[str, Any]] = []
        if not headline:
            row_errors.append({"row": offset, "field": "headline", "message": "empty"})
        elif len(headline) > HEADLINE_MAX:
            row_errors.append({
                "row": offset,
                "field": "headline",
                "message": f"too_long: {len(headline)} > {HEADLINE_MAX}",
            })

        if headline2 and len(headline2) > HEADLINE2_MAX:
            row_errors.append({
                "row": offset,
                "field": "headline2",
                "message": f"too_long: {len(headline2)} > {HEADLINE2_MAX}",
            })

        if not text:
            row_errors.append({"row": offset, "field": "text", "message": "empty"})
        elif len(text) > TEXT_MAX:
            row_errors.append({
                "row": offset,
                "field": "text",
                "message": f"too_long: {len(text)} > {TEXT_MAX}",
            })

        errors.extend(row_errors)

        # Still record the ad — frontend uses the raw values plus `audit`
        # to show what went wrong.  Drop only when the core fields are
        # completely empty (handled above).
        if not headline and not text:
            continue

        keywords = _split_keywords(keywords_raw)

        ad = {
            "row": offset,
            "campaign": campaign,
            "group": group,
            "headline": headline,
            "headline2": headline2 or None,
            "text": text,
            "keywords": keywords,
        }
        ads.append(ad)

        key = campaign or "(unnamed)"
        camp_entry = campaigns.setdefault(key, {"name": key, "groups": set(), "ads_count": 0})
        if group:
            camp_entry["groups"].add(group)
        camp_entry["ads_count"] += 1

    workbook.close()

    return {
        "campaigns": [
            {
                "name": c["name"],
                "groups": sorted(c["groups"]),
                "ads_count": c["ads_count"],
            }
            for c in campaigns.values()
        ],
        "ads": ads,
        "errors": errors,
    }


async def parse_direct_excel(file: UploadFile, *, max_bytes: int) -> dict[str, Any]:
    """Read an uploaded XLSX and return parsed ads + collected errors.

    `max_bytes` is enforced while reading — anything larger returns an
    empty result with a single error entry, never an exception.
    """
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(64 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            return {
                "campaigns": [],
                "ads": [],
                "errors": [{
                    "row": 0,
                    "field": "file",
                    "message": f"file_too_large: > {max_bytes} bytes",
                }],
            }
        chunks.append(chunk)

    data = b"".join(chunks)
    return await parse_direct_excel_bytes(data, max_bytes=max_bytes)


async def parse_direct_excel_bytes(
    data: bytes, *, max_bytes: int
) -> dict[str, Any]:
    """Parse raw XLSX bytes. Same error contract as `parse_direct_excel`."""
    if len(data) > max_bytes:
        return {
            "campaigns": [],
            "ads": [],
            "errors": [{
                "row": 0,
                "field": "file",
                "message": f"file_too_large: > {max_bytes} bytes",
            }],
        }
    if not data:
        return {
            "campaigns": [],
            "ads": [],
            "errors": [{"row": 0, "field": "file", "message": "empty_file"}],
        }
    return await asyncio.to_thread(_parse_workbook_bytes, data)
