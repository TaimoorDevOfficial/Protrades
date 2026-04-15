import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from deps import require_session
from models import BrokerSession

router = APIRouter(prefix="/data", tags=["data"])


def _parse_list(raw: str) -> list:
    try:
        v = json.loads(raw or "[]")
        return v if isinstance(v, list) else []
    except json.JSONDecodeError:
        return []


@router.get("/holdings")
def holdings(session: BrokerSession = Depends(require_session)):
    return {"holdings": _parse_list(session.holdings_json)}


@router.get("/positions")
def positions(session: BrokerSession = Depends(require_session)):
    return {"positions": _parse_list(session.positions_json)}


@router.get("/orders")
def orders(session: BrokerSession = Depends(require_session)):
    return {"orders": _parse_list(session.orders_json)}


@router.get("/funds")
def funds(session: BrokerSession = Depends(require_session)):
    try:
        return json.loads(session.funds_json or "{}")
    except json.JSONDecodeError:
        return {}


@router.get("/summary")
def summary(session: BrokerSession = Depends(require_session)):
    positions = _parse_list(session.positions_json)
    pnl = sum(float(p.get("pnl") or 0) for p in positions if isinstance(p, dict))
    funds = {}
    try:
        funds = json.loads(session.funds_json or "{}")
    except json.JSONDecodeError:
        pass
    return {
        "open_pnl": pnl,
        "positions_count": len(positions),
        "funds": funds,
        "updated_at": session.updated_at.isoformat() if session.updated_at else None,
    }
