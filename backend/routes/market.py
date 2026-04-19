import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from config import get_settings
from database import get_db
from deps import require_session
from models import Watchlist
from security import decrypt_value
from services.nse_ca import nse_corporate_actions, symbol_from_ca_row
from services.rupeezzy import RupeezzyClient
from services.vortex_instruments import resolve_instrument_token

router = APIRouter(prefix="/market", tags=["market"])
logger = logging.getLogger(__name__)

# Short-lived server cache: ProBot + Market often request the same payload back-to-back.
_BRIEF_CACHE: dict[int, tuple[float, dict[str, Any]]] = {}
_BRIEF_TTL_SEC = 12.0
_MAX_BRIEF_CACHE = 200


def _brief_cache_get(session_id: int | None) -> dict[str, Any] | None:
    if session_id is None:
        return None
    ent = _BRIEF_CACHE.get(session_id)
    if not ent:
        return None
    exp, payload = ent
    if time.monotonic() > exp:
        del _BRIEF_CACHE[session_id]
        return None
    return payload


def _brief_cache_set(session_id: int | None, payload: dict[str, Any]) -> None:
    if session_id is None:
        return
    if len(_BRIEF_CACHE) >= _MAX_BRIEF_CACHE and session_id not in _BRIEF_CACHE:
        # Drop arbitrary oldest half (simple bounded dict)
        for k in list(_BRIEF_CACHE.keys())[:50]:
            _BRIEF_CACHE.pop(k, None)
    _BRIEF_CACHE[session_id] = (time.monotonic() + _BRIEF_TTL_SEC, payload)


def _parse_holdings(raw: str) -> list[dict[str, Any]]:
    try:
        v = json.loads(raw or "[]")
        return [x for x in v if isinstance(x, dict)] if isinstance(v, list) else []
    except json.JSONDecodeError:
        return []


def _portfolio_symbol_set(session, db: Session | None) -> set[str]:
    """All symbols from stored holdings + watchlist (for NSE CA filtering)."""
    syms: set[str] = set()
    for h in _parse_holdings(session.holdings_json):
        s = str(h.get("symbol") or h.get("tradingsymbol") or "").upper().strip()
        if s:
            syms.add(s)
    if db is not None:
        for w in db.query(Watchlist).all():
            if w.symbol:
                syms.add(w.symbol.upper().strip())
    return syms


def _norm_ex(raw: str) -> str:
    ex = (raw or "").upper().strip()
    if ex in ("NSE", "NSEEQ", "NSE_EQ"):
        return "NSE_EQ"
    if ex in ("BSE", "BSEEQ", "BSE_EQ"):
        return "BSE_EQ"
    if ex in ("NFO", "NSE_FO"):
        return "NSE_FO"
    return ex or "NSE_EQ"


async def build_market_brief_payload(
    session,
    db: Session | None = None,
    *,
    use_cache: bool = True,
) -> dict[str, Any]:
    """
    No-chatbot market brief for holdings:
    - live LTP from Vortex quotes
    - today's % change vs day open from Vortex historical candles
    - basic corporate actions (NSE) filtered to holding symbols

    Performance: parallel instrument resolve, parallel day-open fetches, NSE CA in parallel
    with broker calls; optional short TTL cache per broker session.
    """
    settings = get_settings()
    sid = getattr(session, "id", None)
    if use_cache:
        hit = _brief_cache_get(sid)
        if hit is not None:
            return hit

    ca_task = asyncio.create_task(nse_corporate_actions())

    try:
        token = decrypt_value(settings, session.rupeezzy_token)
        client = RupeezzyClient(settings)

        holdings = _parse_holdings(session.holdings_json)
        holding_syms: set[str] = set()
        items: list[dict[str, Any]] = []

        # Holdings first (defer instrument resolution — batched below)
        for h in holdings:
            sym = str(h.get("symbol") or h.get("tradingsymbol") or "").upper().strip()
            if not sym:
                continue
            holding_syms.add(sym)
            ex = _norm_ex(str(h.get("exchange") or "NSE_EQ"))
            tok = h.get("token") or h.get("instrument_token")
            token_id: int | None = None
            if tok is not None and str(tok).strip() != "":
                try:
                    token_id = int(float(tok))
                except (TypeError, ValueError):
                    token_id = None
            needs_resolve = token_id is None and not settings.rupeezzy_mock
            items.append(
                {
                    "symbol": sym,
                    "exchange": ex,
                    "token": token_id,
                    "inst": None,
                    "source": "holding",
                    "quantity": float(h.get("quantity") or h.get("qty") or 0),
                    "avg_price": float(h.get("avg_price") or h.get("average_price") or h.get("buy_price") or 0),
                    "raw": h,
                    "_resolve": needs_resolve,
                }
            )

        # Watchlist (avoid duplicates already in holdings)
        if db is not None:
            rows = db.query(Watchlist).order_by(Watchlist.added_at.desc()).all()
            for w in rows:
                sym = (w.symbol or "").upper().strip()
                if not sym or sym in holding_syms:
                    continue
                ex = _norm_ex(w.exchange or "NSE")
                if settings.rupeezzy_mock:
                    token_id = 2885
                    needs_resolve = False
                else:
                    token_id = None
                    needs_resolve = True
                items.append(
                    {
                        "symbol": sym,
                        "exchange": ex,
                        "token": token_id,
                        "inst": None,
                        "source": "watchlist",
                        "quantity": 0.0,
                        "avg_price": 0.0,
                        "raw": {"symbol": sym, "exchange": ex},
                        "_resolve": needs_resolve,
                    }
                )

        idx_resolve = [i for i, it in enumerate(items) if it.get("_resolve")]
        if idx_resolve:
            tasks = [resolve_instrument_token(items[i]["exchange"], items[i]["symbol"]) for i in idx_resolve]
            resolved = await asyncio.gather(*tasks, return_exceptions=True)
            for i, tokr in zip(idx_resolve, resolved):
                if isinstance(tokr, Exception):
                    logger.debug("resolve instrument %s: %s", items[i].get("symbol"), tokr)
                    tokr = None
                items[i]["token"] = tokr

        for it in items:
            it.pop("_resolve", None)
            tid = it.get("token")
            it["inst"] = f"{it['exchange']}-{tid}" if tid is not None else None

        inst_list = [it["inst"] for it in items if it.get("inst")]

        ltps = await client.quotes_ltp(token, inst_list) if inst_list else {}

        open_idx: list[int] = []
        open_tasks: list[Any] = []
        for i, it in enumerate(items):
            if it.get("token") is None:
                continue
            open_idx.append(i)
            open_tasks.append(client.day_open_price(token, it["exchange"], int(it["token"])))

        opens: list[Any] = []
        if open_tasks:
            opens = await asyncio.gather(*open_tasks, return_exceptions=True)

        open_by_i: dict[int, float | None] = {}
        for i, o in zip(open_idx, opens):
            if isinstance(o, Exception):
                logger.warning("day_open_price %s: %s", items[i].get("symbol"), o)
                open_by_i[i] = None
            else:
                open_by_i[i] = o

        out: list[dict[str, Any]] = []
        for i, it in enumerate(items):
            inst_key = it.get("inst")
            if settings.rupeezzy_mock:
                ltp_raw = it["raw"].get("ltp")
                ltp = float(ltp_raw) if ltp_raw is not None else 100.0
            elif inst_key is not None:
                v = ltps.get(inst_key)
                ltp = float(v) if v is not None else None
            else:
                ltp = None

            open_px = open_by_i.get(i)
            chg = (ltp - open_px) if (open_px is not None and ltp is not None) else None
            chg_pct = ((chg / open_px) * 100.0) if (chg is not None and open_px) else None
            pnl = (
                (ltp - float(it["avg_price"] or 0)) * float(it["quantity"] or 0)
                if (ltp is not None and it.get("source") == "holding")
                else None
            )
            out.append(
                {
                    "symbol": it["symbol"],
                    "exchange": it["exchange"],
                    "token": it["token"],
                    "source": it.get("source") or "holding",
                    "quantity": it["quantity"],
                    "avg_price": it["avg_price"],
                    "ltp": ltp,
                    "day_open": open_px,
                    "day_change": chg,
                    "day_change_pct": chg_pct,
                    "pnl": pnl,
                }
            )
    except Exception:
        if not ca_task.done():
            ca_task.cancel()
        raise

    try:
        ca = await ca_task
    except Exception as e:
        logger.warning("nse_corporate_actions failed: %s", e)
        ca = []

    portfolio_syms = _portfolio_symbol_set(session, db)
    ca_filtered = []
    for row in ca:
        s = symbol_from_ca_row(row)
        if s and s in portfolio_syms:
            ca_filtered.append(row)

    if ca and not ca_filtered and portfolio_syms:
        sample = [symbol_from_ca_row(r) for r in ca[:12]]
        logger.info(
            "NSE corporate actions: %s rows from NSE, 0 matched %s portfolio symbols. Sample NSE symbols: %s",
            len(ca),
            len(portfolio_syms),
            sample,
        )

    result = {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "holdings": out,
        "corporate_actions": ca_filtered[:200],
    }
    _brief_cache_set(sid, result)
    return result


@router.get("/brief")
async def market_brief(
    session=Depends(require_session),
    db: Session = Depends(get_db),
    refresh: bool = Query(False, description="Bypass server brief cache"),
):
    return await build_market_brief_payload(session, db=db, use_cache=not refresh)

