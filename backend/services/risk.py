import json
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import pytz

IST = pytz.timezone("Asia/Kolkata")


@dataclass
class RiskConfig:
    max_order_value: float = 100_000.0
    symbol_whitelist: list[str] | None = None
    daily_loss_limit_pct: float = 5.0
    paper_trading: bool = False
    webhooks_disabled: bool = False

    @classmethod
    def from_settings_dict(cls, raw: dict[str, Any]) -> "RiskConfig":
        wl = raw.get("symbol_whitelist")
        if isinstance(wl, str):
            try:
                wl = json.loads(wl)
            except json.JSONDecodeError:
                wl = []
        if wl is None:
            wl = []
        return cls(
            max_order_value=float(raw.get("max_order_value", 100_000)),
            symbol_whitelist=[str(s).upper() for s in wl],
            daily_loss_limit_pct=float(raw.get("daily_loss_limit_pct", 5.0)),
            paper_trading=bool(raw.get("paper_trading", False)),
            webhooks_disabled=bool(raw.get("webhooks_disabled", False)),
        )


_last_signals: dict[str, float] = {}


def _dup_key(symbol: str, action: str) -> str:
    return f"{symbol.upper()}:{action.upper()}"


def is_duplicate_signal(symbol: str, action: str, window_sec: float = 5.0) -> bool:
    key = _dup_key(symbol, action)
    now = time.time()
    last = _last_signals.get(key)
    return last is not None and now - last < window_sec


def register_signal(symbol: str, action: str) -> None:
    _last_signals[_dup_key(symbol, action)] = time.time()


def market_hours_ok(now: datetime | None = None) -> tuple[bool, str]:
    now = now or datetime.now(IST)
    t = now.time()
    open_m = datetime.strptime("09:15", "%H:%M").time()
    close_m = datetime.strptime("15:30", "%H:%M").time()
    if open_m <= t <= close_m:
        return True, "inside_regular_session"
    return False, "outside_market_hours_9_15_to_15_30_IST"


def estimate_order_value(price: float, qty: float) -> float:
    if price and price > 0:
        return float(price) * float(qty)
    return float(qty) * 1.0


def check_risk(
    cfg: RiskConfig,
    symbol: str,
    action: str,
    qty: float,
    price: float,
    day_pnl_pct: float | None,
) -> tuple[bool, str]:
    if cfg.webhooks_disabled:
        return False, "webhooks_disabled_by_daily_loss"
    ok, reason = market_hours_ok()
    if not ok:
        return False, reason
    sym = symbol.upper().split(":")[-1]
    if is_duplicate_signal(sym, action):
        return False, "duplicate_signal_within_5s"
    if cfg.symbol_whitelist and sym not in cfg.symbol_whitelist:
        return False, f"symbol_not_whitelisted:{sym}"
    value = estimate_order_value(price, qty)
    if value > cfg.max_order_value:
        return False, f"max_order_value_exceeded:{value}>{cfg.max_order_value}"
    if day_pnl_pct is not None and day_pnl_pct <= -abs(cfg.daily_loss_limit_pct):
        return False, "daily_loss_limit_breached"
    return True, "ok"
