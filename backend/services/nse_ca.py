"""
NSE public corporate-actions feed (best-effort).
The site often changes shape and may block non-browser / datacenter IPs; we parse flexibly and log failures.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any

import httpx

from config import get_settings

logger = logging.getLogger(__name__)

_BACKEND_DIR = Path(__file__).resolve().parent

_NSE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-IN,en;q=0.9",
    "Referer": "https://www.nseindia.com/companies-listing/corporate-filings-actions",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
}


def symbol_from_ca_row(row: dict[str, Any]) -> str:
    """Normalize symbol from an NSE corporate-action row (field names vary)."""
    # Do not use `series` (e.g. EQ) as symbol — only real ticker fields.
    for k in (
        "symbol",
        "SYMBOL",
        "bm_symbol",
        "BM_SYMBOL",
        "sm_name",
        "SM_NAME",
    ):
        v = row.get(k)
        if v is None or v == "":
            continue
        s = str(v).upper().strip()
        if not s:
            continue
        # "RELIANCE EQ" / "IDEA - SM" → first token
        s = re.split(r"[\s\-]+", s)[0]
        if s and (any(c.isalpha() for c in s) or s.isdigit()):
            return s
    return ""


def _extract_ca_table(payload: Any) -> list[dict[str, Any]]:
    """Find the list of row objects inside NSE JSON (shape changes often)."""
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)]

    if not isinstance(payload, dict):
        return []

    # Most common: { "data": [ {...}, ... ] }
    data = payload.get("data")
    if isinstance(data, list) and data and isinstance(data[0], dict):
        return [x for x in data if isinstance(x, dict)]

    # Sometimes nested
    if isinstance(data, dict):
        for k in ("data", "table", "rows", "records", "corporateActions"):
            inner = data.get(k)
            if isinstance(inner, list) and inner and isinstance(inner[0], dict):
                return [x for x in inner if isinstance(x, dict)]

    # Walk: pick the largest list-of-dicts (likely the main table)
    best: list[dict[str, Any]] = []

    def consider(lst: list) -> None:
        nonlocal best
        if not lst or not isinstance(lst[0], dict):
            return
        rows = [x for x in lst if isinstance(x, dict)]
        if len(rows) > len(best):
            best = rows

    def walk(obj: Any) -> None:
        if isinstance(obj, dict):
            for v in obj.values():
                walk(v)
        elif isinstance(obj, list) and obj:
            consider(obj)
            for x in obj[:50]:
                walk(x)

    walk(payload)
    return best


def _resolve_fallback_path(raw: str) -> Path | None:
    if not (raw or "").strip():
        return None
    p = Path(raw.strip())
    if not p.is_absolute():
        p = _BACKEND_DIR.parent / p
    return p if p.is_file() else None


def load_nse_ca_fallback_file(path: Path) -> list[dict[str, Any]]:
    """Load a JSON array saved from the browser when NSE blocks server-side HTTP (403)."""
    try:
        text = path.read_text(encoding="utf-8")
        data = json.loads(text)
    except (OSError, json.JSONDecodeError) as e:
        logger.warning("NSE CA fallback file invalid: %s", e)
        return []
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    rows = _extract_ca_table(data)
    return rows


async def nse_corporate_actions() -> list[dict[str, Any]]:
    """
    Pull corporate actions from NSE JSON API, then optionally merge/override from a local JSON file
    if live fetch fails (common: 403 from cloud hosts).
    """
    settings = get_settings()
    headers = dict(_NSE_HEADERS)
    cookie = (settings.nse_ca_cookie or "").strip()
    if cookie:
        headers["Cookie"] = cookie

    url = "https://www.nseindia.com/api/corporates-corporateActions?index=equities"
    rows: list[dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=35.0, headers=headers, follow_redirects=True) as client:
        try:
            await client.get("https://www.nseindia.com/")
            r = await client.get(url)
            r.raise_for_status()
            payload = r.json()
        except Exception as e:
            logger.warning("NSE corporate actions request failed: %s", e)
            payload = None

    if payload is not None:
        rows = _extract_ca_table(payload)
        if not rows and isinstance(payload, dict):
            logger.warning(
                "NSE corporate actions: empty table after parse (top keys: %s)",
                list(payload.keys()),
            )

    if rows:
        logger.info("NSE corporate actions: parsed %s rows (live)", len(rows))
        return rows

    fb = _resolve_fallback_path(settings.nse_ca_fallback_json_path)
    if fb:
        fallback = load_nse_ca_fallback_file(fb)
        if fallback:
            logger.info("NSE corporate actions: using %s rows from fallback file %s", len(fallback), fb)
            return fallback

    return []
