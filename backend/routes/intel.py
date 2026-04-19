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
from routes.market import build_market_brief_payload
from services.nse_ca import nse_corporate_actions, symbol_from_ca_row

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


def _dedupe(items: list[str]) -> list[str]:
    seen = set()
    out = []
    for s in items:
        if s not in seen:
            seen.add(s)
            out.append(s)
    return out


def _event_tag(title: str) -> str:
    t = (title or "").lower()
    if "dividend" in t:
        return "dividend"
    if "split" in t:
        return "split"
    if "bonus" in t:
        return "bonus"
    if "rights" in t:
        return "rights"
    if "buyback" in t:
        return "buyback"
    if "board" in t or "results" in t or "earnings" in t:
        return "earnings"
    return "corporate"


def _headline_tone(text: str) -> str:
    t = (text or "").lower()
    pos = sum(k in t for k in ["beats", "surge", "jumps", "wins", "strong", "upgrade", "profit rises", "order win"])
    neg = sum(k in t for k in ["falls", "drops", "slump", "downgrade", "misses", "fraud", "probe", "loss widens"])
    if pos > neg:
        return "positive"
    if neg > pos:
        return "negative"
    return "neutral"


def _action_line(symbol: str, price_move: float | None, tone: str, events: list[str], held: bool) -> str:
    """
    Rules-based suggestion generator. Not investment advice.
    """
    if events:
        if "earnings" in events:
            return f"{symbol}: review before results/board event; expect volatility."
        if any(e in events for e in ["dividend", "bonus", "split", "rights", "buyback"]):
            return f"{symbol}: corporate action detected; review dates and eligibility."
    if price_move is not None:
        if price_move >= 4:
            return f"{symbol}: strong up move today; avoid chasing, wait for confirmation."
        if price_move <= -4:
            return f"{symbol}: sharp weakness today; reassess thesis and news before adding."
    if tone == "negative":
        return f"{symbol}: negative news flow; monitor closely and review exposure."
    if tone == "positive" and held:
        return f"{symbol}: positive flow while already held; keep on watch for follow-through."
    return f"{symbol}: no high-priority trigger; continue monitoring."


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
        s = symbol_from_ca_row(row)
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


@router.get("/brief")
async def brief(db: Session = Depends(get_db), session=Depends(require_session)):
    """
    Rules-based daily briefing without Claude:
    - market movers for holdings
    - event tags from corporate actions
    - simple tone from headlines
    - concise actionable lines
    """
    intel_data = await stream(db=db, session=session, q=None)
    market_data = await build_market_brief_payload(session)

    items = intel_data.get("items", [])
    holdings = market_data.get("holdings", [])
    held_symbols = {h.get("symbol") for h in holdings if h.get("symbol")}
    all_symbols = _dedupe(intel_data.get("symbols", []))

    by_symbol: dict[str, dict[str, Any]] = {}
    for sym in all_symbols:
        by_symbol[sym] = {
            "symbol": sym,
            "held": sym in held_symbols,
            "price_move_pct": None,
            "events": [],
            "news_count": 0,
            "positive_news": 0,
            "negative_news": 0,
        }

    for h in holdings:
        sym = h.get("symbol")
        if sym in by_symbol:
            by_symbol[sym]["price_move_pct"] = h.get("day_change_pct")
            by_symbol[sym]["pnl"] = h.get("pnl")
            by_symbol[sym]["ltp"] = h.get("ltp")

    for it in items:
        sym = it.get("symbol")
        if sym not in by_symbol:
            continue
        if it.get("type") == "corporate_action":
            tag = _event_tag(it.get("title", ""))
            if tag not in by_symbol[sym]["events"]:
                by_symbol[sym]["events"].append(tag)
        elif it.get("type") in ("news", "tweet"):
            by_symbol[sym]["news_count"] += 1
            tone = _headline_tone(f"{it.get('title','')} {it.get('summary','')}")
            if tone == "positive":
                by_symbol[sym]["positive_news"] += 1
            elif tone == "negative":
                by_symbol[sym]["negative_news"] += 1

    cards = []
    for sym, data in by_symbol.items():
        tone = "neutral"
        if data["positive_news"] > data["negative_news"]:
            tone = "positive"
        elif data["negative_news"] > data["positive_news"]:
            tone = "negative"
        cards.append(
            {
                **data,
                "tone": tone,
                "action": _action_line(sym, data["price_move_pct"], tone, data["events"], bool(data["held"])),
            }
        )

    def _priority(c: dict[str, Any]) -> tuple:
        move = abs(float(c.get("price_move_pct") or 0))
        event_score = 3 if c.get("events") else 0
        tone_score = 2 if c.get("tone") in ("positive", "negative") else 0
        held_score = 1 if c.get("held") else 0
        return (event_score + tone_score + held_score, move)

    cards.sort(key=_priority, reverse=True)

    top_gainers = sorted(
        [c for c in cards if c.get("price_move_pct") is not None],
        key=lambda c: float(c.get("price_move_pct") or 0),
        reverse=True,
    )[:5]
    top_losers = sorted(
        [c for c in cards if c.get("price_move_pct") is not None],
        key=lambda c: float(c.get("price_move_pct") or 0),
    )[:5]

    summary_lines = []
    if top_gainers:
        summary_lines.append(
            "Top gainers: " + ", ".join(f"{c['symbol']} ({float(c['price_move_pct']):.2f}%)" for c in top_gainers[:3])
        )
    if top_losers:
        summary_lines.append(
            "Top losers: " + ", ".join(f"{c['symbol']} ({float(c['price_move_pct']):.2f}%)" for c in top_losers[:3])
        )
    event_syms = [c["symbol"] for c in cards if c.get("events")]
    if event_syms:
        summary_lines.append("Event watch: " + ", ".join(event_syms[:6]))

    return {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "summary": summary_lines,
        "cards": cards[:30],
        "top_gainers": top_gainers,
        "top_losers": top_losers,
    }

