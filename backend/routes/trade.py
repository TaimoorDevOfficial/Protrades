import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import get_settings
from database import get_db
from deps import require_session
from models import BrokerSession, WebhookLog
from security import decrypt_value
from services.risk import RiskConfig, check_risk, register_signal
from services.rupeezzy import RupeezzyClient, vortex_order_id
from services.settings_store import get_risk_dict

router = APIRouter(prefix="/trade", tags=["trade"])


class PlaceTradeBody(BaseModel):
    symbol: str
    action: str = "BUY"  # BUY/SELL
    qty: float = 1
    exchange: str = "NSE"
    product: str = "CNC"
    ordertype: str = "MARKET"  # MARKET/LIMIT
    price: float | None = None
    token: int | None = None
    strategy: str | None = "manual_trade"


def _day_pnl_pct_from_session(session: BrokerSession) -> float | None:
    try:
        pos = json.loads(session.positions_json or "[]")
        funds = json.loads(session.funds_json or "{}")
        avail = float(funds.get("available") or funds.get("available_balance") or 0) or 1.0
        if isinstance(pos, list):
            pnl = sum(float(p.get("pnl") or 0) for p in pos if isinstance(p, dict))
            return (pnl / avail) * 100.0
    except (json.JSONDecodeError, TypeError, ValueError):
        return None
    return None


@router.post("/place")
async def place_trade(
    body: PlaceTradeBody,
    db: Session = Depends(get_db),
    session: BrokerSession = Depends(require_session),
):
    settings = get_settings()
    token = decrypt_value(settings, session.rupeezzy_token)
    if not token and not settings.rupeezzy_mock:
        raise HTTPException(status_code=401, detail="Broker token missing; please log in again.")

    risk_dict = get_risk_dict(db)
    risk = RiskConfig.from_settings_dict(risk_dict)
    day_pnl = _day_pnl_pct_from_session(session)

    sym = (body.symbol or "").strip().upper()
    if not sym:
        raise HTTPException(status_code=400, detail="Symbol is required")

    action = (body.action or "BUY").strip().upper()
    qty = float(body.qty or 0)
    if qty <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be > 0")

    ordertype = (body.ordertype or "MARKET").strip().upper()
    exchange = (body.exchange or "NSE").strip().upper()
    product = (body.product or "CNC").strip().upper()
    price = float(body.price or 0)

    ok, reason = check_risk(risk, sym, action, qty, price, day_pnl)
    status = "rejected"
    order_id = ""
    message = reason

    norm: dict[str, Any] = {
        "strategy": str(body.strategy or "manual_trade"),
        "symbol": sym,
        "action": action,
        "qty": qty,
        "price": price,
        "ordertype": ordertype,
        "exchange": exchange,
        "product": product,
        "token": body.token,
    }

    if ok:
        if risk.paper_trading:
            order_id = f"PAPER-{int(datetime.now(timezone.utc).timestamp())}"
            status = "paper_logged"
            message = "paper_mode"
            register_signal(sym, action)
        else:
            client = RupeezzyClient(settings)
            try:
                resp = await client.place_order_from_norm(token, norm)
                order_id = vortex_order_id(resp)
                status = "success"
                message = "routed"
                register_signal(sym, action)
            except Exception as e:
                status = "error"
                message = str(e)

    db.add(
        WebhookLog(
            source="trade",
            symbol=sym,
            action=action,
            qty=qty,
            status=status,
            order_id=order_id,
            raw_payload=json.dumps(norm),
            message=message,
        )
    )
    db.commit()

    return {
        "platform": "protrades",
        "status": "success" if status in ("success", "paper_logged") else status,
        "order_id": order_id or None,
        "detail": message,
    }

