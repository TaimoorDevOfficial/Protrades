from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import get_settings
from database import get_db
from deps import require_session
from models import Strategy, Watchlist
from services.settings_store import (
    ensure_protrades_api_key,
    get_risk_dict,
    get_setting,
    save_risk_dict,
    set_setting,
)

router = APIRouter(prefix="/settings", tags=["settings"])


class RiskBody(BaseModel):
    max_order_value: float | None = None
    symbol_whitelist: list[str] | None = None
    daily_loss_limit_pct: float | None = None
    paper_trading: bool | None = None
    webhooks_disabled: bool | None = None


class KeysBody(BaseModel):
    claude_key: str | None = None
    rupeezzy_api_key: str | None = None
    rupeezzy_api_secret: str | None = None


@router.get("")
def get_settings_api(db: Session = Depends(get_db), _: None = Depends(require_session)):
    return {
        "protrades_api_key": ensure_protrades_api_key(db),
        "risk": get_risk_dict(db),
        "has_claude_key": bool(get_setting(db, "claude_key_store")),
        "public_app_url": get_settings().public_app_url,
    }


@router.post("/risk")
def post_risk(body: RiskBody, db: Session = Depends(get_db), _: None = Depends(require_session)):
    cur = get_risk_dict(db)
    if body.max_order_value is not None:
        cur["max_order_value"] = body.max_order_value
    if body.symbol_whitelist is not None:
        cur["symbol_whitelist"] = [s.upper() for s in body.symbol_whitelist]
    if body.daily_loss_limit_pct is not None:
        cur["daily_loss_limit_pct"] = body.daily_loss_limit_pct
    if body.paper_trading is not None:
        cur["paper_trading"] = body.paper_trading
    if body.webhooks_disabled is not None:
        cur["webhooks_disabled"] = body.webhooks_disabled
    save_risk_dict(db, cur)
    return cur


@router.post("/keys")
def post_keys(body: KeysBody, db: Session = Depends(get_db), _: None = Depends(require_session)):
    if body.claude_key:
        set_setting(db, "claude_key_store", body.claude_key, encrypt=True)
    if body.rupeezzy_api_key:
        set_setting(db, "rupeezzy_api_key", body.rupeezzy_api_key, encrypt=True)
    if body.rupeezzy_api_secret:
        set_setting(db, "rupeezzy_api_secret", body.rupeezzy_api_secret, encrypt=True)
    return {"status": "ok"}


class WatchBody(BaseModel):
    symbol: str
    exchange: str = "NSE"


@router.get("/watchlist")
def list_watch(db: Session = Depends(get_db), _: None = Depends(require_session)):
    rows = db.query(Watchlist).order_by(Watchlist.added_at.desc()).all()
    return [{"id": r.id, "symbol": r.symbol, "exchange": r.exchange} for r in rows]


@router.post("/watchlist")
def add_watch(body: WatchBody, db: Session = Depends(get_db), _: None = Depends(require_session)):
    row = Watchlist(symbol=body.symbol.upper(), exchange=body.exchange.upper())
    db.add(row)
    db.commit()
    return {"id": row.id}


@router.delete("/watchlist/{wid}")
def del_watch(wid: int, db: Session = Depends(get_db), _: None = Depends(require_session)):
    row = db.get(Watchlist, wid)
    if not row:
        raise HTTPException(status_code=404)
    db.delete(row)
    db.commit()
    return {"status": "ok"}


class StrategyBody(BaseModel):
    name: str
    source: str = "custom"
    symbol_list: list[str] = []
    is_active: bool = True


@router.get("/strategies")
def list_strategies(db: Session = Depends(get_db), _: None = Depends(require_session)):
    rows = db.query(Strategy).order_by(Strategy.created_at.desc()).all()
    import json

    out = []
    for r in rows:
        try:
            syms = json.loads(r.symbol_list or "[]")
        except json.JSONDecodeError:
            syms = []
        out.append(
            {
                "id": r.id,
                "name": r.name,
                "source": r.source,
                "symbol_list": syms,
                "is_active": r.is_active,
                "created_at": r.created_at.isoformat(),
            }
        )
    return out


@router.post("/strategies")
def add_strategy(body: StrategyBody, db: Session = Depends(get_db), _: None = Depends(require_session)):
    import json

    row = Strategy(
        name=body.name,
        source=body.source,
        symbol_list=json.dumps(body.symbol_list),
        is_active=body.is_active,
    )
    db.add(row)
    db.commit()
    return {"id": row.id}


@router.patch("/strategies/{sid}")
def patch_strategy(sid: int, body: StrategyBody, db: Session = Depends(get_db), _: None = Depends(require_session)):
    import json

    row = db.get(Strategy, sid)
    if not row:
        raise HTTPException(status_code=404)
    row.name = body.name
    row.source = body.source
    row.symbol_list = json.dumps(body.symbol_list)
    row.is_active = body.is_active
    db.commit()
    return {"status": "ok"}
