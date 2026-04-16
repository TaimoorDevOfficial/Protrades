import json
import re
from datetime import datetime, timezone
from typing import Any
from xml.etree import ElementTree as ET

import httpx
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from deps import require_session
from models import Watchlist
from services.rupeezzy import nse_corporate_actions

router = APIRouter(prefix="/intel", tags=["intel"])


def _parse_holdings_symbols(raw: str) -> list[str]:
    try:
        v = json.loads(raw or "[]")
    except json.JSONDecodeError:
        return []
    out: list[str] = []
    if isinstance(v, list):
        for h in v:
            if not isinstance(h, dict):
                continue
            sym = str(h.get("symbol") or h.get("tradingsymbol") or "").upper().strip()
            if sym:
                out.append(sym)
    # de-dup preserve order
    seen = set()
    uniq = []
    for s in out:
        if s not in seen:
            seen.add(s)
            uniq.append(s)
    return uniq


def _strip_html(s: str) -> str:
    return re.sub(r"<[^>]+>", "", s or "").strip()


def _parse_rss(xml_text: str) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return items
    for it in root.findall(".//item"):
        title = it.findtext("title") or ""
        link = it.findtext("link") or ""
        pub = it.findtext("pubDate") or ""
        desc = it.findtext("description") or ""
        items.append(
            {
                "title": _strip_html(title),
                "url": link.strip(),
                "published_at": pub.strip(),
                "summary": _strip_html(desc)[:400],
            }
        )
    return items


async def _google_news(symbol: str) -> list[dict[str, Any]]:
    # Google News RSS is public and doesn’t need an API key.
    q = httpx.QueryParams(
        {
            "q": f"{symbol} stock",
            "hl": "en-IN",
            "gl": "IN",
            "ceid": "IN:en",
        }
    )
    url = f"https://news.google.com/rss/search?{q}"
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.get(url)
        r.raise_for_status()
        return _parse_rss(r.text)


async def _nitter_search(symbol: str, base: str) -> list[dict[str, Any]]:
    # Best-effort “tweets” via Nitter RSS. Optional env-driven; may not work in all regions.
    url = base.rstrip("/") + "/search/rss"
    params = {"f": "tweets", "q": f"{symbol} stock"}
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        return _parse_rss(r.text)


@router.get("/stream")
async def stream(
    q: str | None = Query(default=None, description="Optional extra query term"),
    db: Session = Depends(get_db),
    session=Depends(require_session),
):
    """
    Intelligence feed for holdings + watchlist.
    Returns corporate actions + news (+ optional tweets via Nitter RSS) — no trading.
    """
    holdings_syms = _parse_holdings_symbols(session.holdings_json)
    watch = db.query(Watchlist).order_by(Watchlist.added_at.desc()).all()
    watch_syms = [w.symbol.upper() for w in watch if w.symbol]

    symbols = []
    for s in holdings_syms + watch_syms:
        if s not in symbols:
            symbols.append(s)
    if q:
        # when q is provided, include it as a pseudo-symbol query context
        pass

    # Corporate actions (NSE) – filter by our symbols set
    ca = await nse_corporate_actions()
    sym_set = set(symbols)
    ca_items = []
    for row in ca:
        s = str(row.get("symbol") or row.get("SYMBOL") or "").upper().strip()
        if s and s in sym_set:
            ca_items.append(
                {
                    "type": "corporate_action",
                    "symbol": s,
                    "title": str(row.get("subject") or row.get("SUBJECT") or row.get("purpose") or "Corporate action"),
                    "published_at": str(row.get("exDate") or row.get("ex_date") or row.get("EXDATE") or ""),
                    "source": "NSE",
                    "url": "",
                    "raw": row,
                }
            )

    # News per symbol (Google News RSS)
    news_items: list[dict[str, Any]] = []
    for s in symbols[:25]:
        try:
            items = await _google_news(s)
        except Exception:
            items = []
        for it in items[:8]:
            news_items.append(
                {
                    "type": "news",
                    "symbol": s,
                    "title": it.get("title") or "",
                    "published_at": it.get("published_at") or "",
                    "source": "Google News",
                    "url": it.get("url") or "",
                    "summary": it.get("summary") or "",
                }
            )

    # Optional “tweets”
    tweet_items: list[dict[str, Any]] = []
    # Read from env via SettingsConfigDict extra=ignore (so we can't access directly); use os.getenv.
    import os

    nitter = os.getenv("NITTER_BASE", "").strip()
    if nitter:
        for s in symbols[:10]:
            try:
                items = await _nitter_search(s, nitter)
            except Exception:
                items = []
            for it in items[:5]:
                tweet_items.append(
                    {
                        "type": "tweet",
                        "symbol": s,
                        "title": it.get("title") or "",
                        "published_at": it.get("published_at") or "",
                        "source": "Nitter",
                        "url": it.get("url") or "",
                        "summary": it.get("summary") or "",
                    }
                )

    return {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "symbols": symbols,
        "items": (ca_items + news_items + tweet_items)[:500],
    }

