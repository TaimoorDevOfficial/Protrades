"""Resolve Rupeezy Vortex instrument tokens from the public master CSV."""

from __future__ import annotations

import csv
import io
import time
from typing import Any

import httpx

MASTER_URL = "https://static.rupeezy.in/master.csv"
_CACHE_TTL_SEC = 3600
_cache_rows: list[dict[str, Any]] | None = None
_cache_loaded_at: float = 0.0


async def _load_master() -> list[dict[str, Any]]:
    global _cache_rows, _cache_loaded_at
    now = time.monotonic()
    if _cache_rows is not None and (now - _cache_loaded_at) < _CACHE_TTL_SEC:
        return _cache_rows
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.get(MASTER_URL)
        r.raise_for_status()
    text = r.text
    reader = csv.DictReader(io.StringIO(text))
    rows = [dict(row) for row in reader]
    _cache_rows = rows
    _cache_loaded_at = now
    return rows


def _parse_token(row: dict[str, Any]) -> int | None:
    try:
        return int(str(row.get("token", "")).strip())
    except ValueError:
        return None


async def resolve_instrument_token(exchange: str, symbol: str) -> int | None:
    """
    Look up Vortex token for exchange + symbol using static master.csv.
    For NSE_EQ / BSE_EQ cash symbols, prefers series EQ rows when multiple exist.
    F&O often has many rows per symbol; returns a token only when the match is unique.
    """
    ex = exchange.strip().upper()
    sym = symbol.strip().upper()
    if not sym:
        return None
    rows = await _load_master()
    matches: list[dict[str, Any]] = []
    for row in rows:
        if (row.get("exchange") or "").strip().upper() != ex:
            continue
        if (row.get("symbol") or "").strip().upper() != sym:
            continue
        matches.append(row)
    if not matches:
        return None
    if len(matches) == 1:
        return _parse_token(matches[0])
    if ex in ("NSE_EQ", "BSE_EQ"):
        eq = [m for m in matches if (m.get("series") or "").strip().upper() == "EQ"]
        if len(eq) == 1:
            return _parse_token(eq[0])
    return None


def clear_master_cache_for_tests() -> None:
    global _cache_rows, _cache_loaded_at
    _cache_rows = None
    _cache_loaded_at = 0.0
