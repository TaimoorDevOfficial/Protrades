import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from config import get_settings
from database import get_db
from deps import require_session
from security import decrypt_value
from services.rupeezzy import RupeezzyClient, nse_corporate_actions
from services.vortex_instruments import resolve_instrument_token

router = APIRouter(prefix="/market", tags=["market"])


def _parse_holdings(raw: str) -> list[dict[str, Any]]:
    try:
        v = json.loads(raw or "[]")
        return [x for x in v if isinstance(x, dict)] if isinstance(v, list) else []
    except json.JSONDecodeError:
        return []


@router.get("/brief")
async def market_brief(session=Depends(require_session), db: Session = Depends(get_db)):
    """
    No-chatbot market brief for holdings:
    - live LTP from Vortex quotes
    - today's % change vs day open from Vortex historical candles
    - basic corporate actions (NSE) filtered to holding symbols
    """
    settings = get_settings()
    token = decrypt_value(settings, session.rupeezzy_token)
    client = RupeezzyClient(settings)

    holdings = _parse_holdings(session.holdings_json)
    # Only equities for now
    items: list[dict[str, Any]] = []
    inst_list: list[str] = []
    for h in holdings:
        sym = str(h.get("symbol") or h.get("tradingsymbol") or "").upper().strip()
        if not sym:
            continue
        ex = str(h.get("exchange") or "NSE_EQ").upper().strip()
        if ex in ("NSE", "NSEEQ", "NSE_EQ"):
            ex = "NSE_EQ"
        if ex in ("BSE", "BSEEQ", "BSE_EQ"):
            ex = "BSE_EQ"
        tok = h.get("token") or h.get("instrument_token")
        token_id: int | None = None
        if tok is not None and str(tok).strip() != "":
            try:
                token_id = int(float(tok))
            except (TypeError, ValueError):
                token_id = None
        if token_id is None and not settings.rupeezzy_mock:
            token_id = await resolve_instrument_token(ex, sym)
        if token_id is None:
            continue
        inst = f"{ex}-{token_id}"
        inst_list.append(inst)
        items.append(
            {
                "symbol": sym,
                "exchange": ex,
                "token": token_id,
                "quantity": float(h.get("quantity") or h.get("qty") or 0),
                "avg_price": float(h.get("avg_price") or h.get("average_price") or h.get("buy_price") or 0),
                "raw": h,
            }
        )

    ltps = await client.quotes_ltp(token, inst_list)

    out = []
    for it in items:
        inst = f"{it['exchange']}-{it['token']}"
        ltp = float(ltps.get(inst) or 0) if not settings.rupeezzy_mock else float(it["raw"].get("ltp") or 100.0)
        open_px = await client.day_open_price(token, it["exchange"], int(it["token"]))
        chg = (ltp - open_px) if (open_px and ltp) else None
        chg_pct = ((chg / open_px) * 100.0) if (chg is not None and open_px) else None
        pnl = (ltp - float(it["avg_price"] or 0)) * float(it["quantity"] or 0) if ltp else None
        out.append(
            {
                "symbol": it["symbol"],
                "exchange": it["exchange"],
                "token": it["token"],
                "quantity": it["quantity"],
                "avg_price": it["avg_price"],
                "ltp": ltp or None,
                "day_open": open_px,
                "day_change": chg,
                "day_change_pct": chg_pct,
                "pnl": pnl,
            }
        )

    ca = await nse_corporate_actions()
    sym_set = {o["symbol"] for o in out}
    ca_filtered = []
    for row in ca:
        s = str(row.get("symbol") or row.get("SYMBOL") or "").upper().strip()
        if s and s in sym_set:
            ca_filtered.append(row)

    return {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "holdings": out,
        "corporate_actions": ca_filtered[:200],
    }

