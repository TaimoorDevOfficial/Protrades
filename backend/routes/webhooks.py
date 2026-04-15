import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from sqlalchemy.orm import Session

from config import get_settings
from database import get_db
from models import BrokerSession, WebhookLog
from security import decrypt_value
from services.normalizer import (
    normalize_amibroker,
    normalize_chartink,
    normalize_python,
    normalize_tradingview,
)
from services.rupeezzy import RupeezzyClient, vortex_order_id
from services.risk import RiskConfig, check_risk, register_signal
from services.settings_store import ensure_protrades_api_key, get_risk_dict, save_risk_dict

router = APIRouter(tags=["webhooks"])


def _validate_key(db: Session, header_key: str | None, query_key: str | None = None) -> None:
    expected = ensure_protrades_api_key(db)
    got = (header_key or query_key or "").strip()
    if got != expected:
        raise HTTPException(status_code=401, detail="Invalid X-ProTrades-Key or key query param")


def _latest_broker(db: Session) -> BrokerSession | None:
    return db.query(BrokerSession).order_by(BrokerSession.id.desc()).first()


def _day_pnl_pct(session: BrokerSession | None) -> float | None:
    if not session:
        return None
    try:
        pos = json.loads(session.positions_json or "[]")
        funds = json.loads(session.funds_json or "{}")
        avail = float(funds.get("available") or funds.get("available_balance") or 0) or 1.0
        if isinstance(pos, list):
            pnl = sum(float(p.get("pnl") or 0) for p in pos if isinstance(p, dict))
            return (pnl / avail) * 100.0
    except (json.JSONDecodeError, TypeError, ValueError):
        pass
    return None


async def _process_order(
    db: Session,
    source: str,
    norm: dict[str, Any],
    raw_payload: str,
) -> dict[str, Any]:
    settings = get_settings()
    risk_dict = get_risk_dict(db)
    risk = RiskConfig.from_settings_dict(risk_dict)
    broker = _latest_broker(db)
    day_pnl = _day_pnl_pct(broker)
    if day_pnl is not None and day_pnl <= -abs(risk.daily_loss_limit_pct):
        if not risk_dict.get("webhooks_disabled"):
            risk_dict["webhooks_disabled"] = True
            save_risk_dict(db, risk_dict)
            risk.webhooks_disabled = True

    ok, reason = check_risk(
        risk,
        norm["symbol"],
        norm["action"],
        float(norm["qty"]),
        float(norm.get("price") or 0),
        day_pnl,
    )
    order_id = ""
    status = "rejected"
    message = reason
    if ok:
        if risk.paper_trading:
            order_id = f"PAPER-{int(datetime.now(timezone.utc).timestamp())}"
            status = "paper_logged"
            message = "paper_mode"
            register_signal(norm["symbol"], norm["action"])
        else:
            if not broker:
                status = "rejected"
                message = "no_broker_session"
            else:
                token = decrypt_value(settings, broker.rupeezzy_token)
                client = RupeezzyClient(settings)
                try:
                    resp = await client.place_order_from_norm(token, norm)
                    order_id = vortex_order_id(resp)
                    status = "success"
                    message = "routed"
                    register_signal(norm["symbol"], norm["action"])
                except Exception as e:
                    status = "error"
                    message = str(e)

    log = WebhookLog(
        source=source,
        symbol=norm.get("symbol", ""),
        action=norm.get("action", ""),
        qty=float(norm.get("qty") or 0),
        status=status,
        order_id=order_id,
        raw_payload=raw_payload,
        message=message,
    )
    db.add(log)
    db.commit()

    return {
        "platform": "protrades",
        "status": "success" if status in ("success", "paper_logged") else status,
        "order_id": order_id or None,
        "detail": message,
    }


@router.post("/amibroker")
async def webhook_amibroker(
    request: Request,
    db: Session = Depends(get_db),
    x_protrades_key: str | None = Header(default=None, alias="X-ProTrades-Key"),
):
    _validate_key(db, x_protrades_key)
    body = await request.json()
    norm = normalize_amibroker(body)
    raw = json.dumps(body)
    return await _process_order(db, "amibroker", norm, raw)


@router.post("/tradingview")
async def webhook_tradingview(
    request: Request,
    db: Session = Depends(get_db),
    x_protrades_key: str | None = Header(default=None, alias="X-ProTrades-Key"),
    key: str | None = Query(default=None, description="Alternate auth for platforms without custom headers"),
):
    _validate_key(db, x_protrades_key, key)
    body = await request.json()
    norm = normalize_tradingview(body)
    raw = json.dumps(body)
    return await _process_order(db, "tradingview", norm, raw)


@router.post("/chartink")
async def webhook_chartink(
    request: Request,
    db: Session = Depends(get_db),
    x_protrades_key: str | None = Header(default=None, alias="X-ProTrades-Key"),
    key: str | None = Query(default=None),
):
    _validate_key(db, x_protrades_key, key)
    body = await request.json()
    norms = normalize_chartink(body)
    raw = json.dumps(body)
    results = []
    for norm in norms:
        results.append(await _process_order(db, "chartink", norm, raw))
    return {"platform": "protrades", "results": results}


@router.post("/python")
async def webhook_python(
    request: Request,
    db: Session = Depends(get_db),
    x_protrades_key: str | None = Header(default=None, alias="X-ProTrades-Key"),
):
    _validate_key(db, x_protrades_key)
    body = await request.json()
    norm = normalize_python(body)
    raw = json.dumps(body)
    return await _process_order(db, "python", norm, raw)
