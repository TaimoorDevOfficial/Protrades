from typing import Any, Literal

Source = Literal["amibroker", "tradingview", "chartink", "python"]


def _opt_token(body: dict[str, Any]) -> Any:
    t = body.get("token")
    if t is None or t == "":
        return None
    try:
        return int(float(t))
    except (TypeError, ValueError):
        return None


def normalize_amibroker(body: dict[str, Any]) -> dict[str, Any]:
    return {
        "strategy": str(body.get("strategy", "")),
        "symbol": str(body.get("symbol", "")).upper(),
        "action": str(body.get("action", "")).upper(),
        "qty": float(body.get("qty") or body.get("quantity") or 0),
        "price": float(body.get("price") or 0),
        "ordertype": str(body.get("ordertype", "MARKET")).upper(),
        "exchange": str(body.get("exchange", "NSE")).upper(),
        "product": str(body.get("product", "CNC")).upper(),
        "token": _opt_token(body),
    }


def normalize_tradingview(body: dict[str, Any]) -> dict[str, Any]:
    ticker = str(body.get("ticker", ""))
    sym = ticker.split(":")[-1].upper() if ticker else ""
    return {
        "strategy": str(body.get("strategy_id", "")),
        "symbol": sym,
        "action": str(body.get("action", "")).upper(),
        "qty": float(body.get("quantity") or body.get("qty") or 0),
        "price": float(body.get("price") or 0),
        "ordertype": "MARKET",
        "exchange": "NSE",
        "product": "MIS",
        "token": _opt_token(body),
    }


def normalize_chartink(body: dict[str, Any]) -> list[dict[str, Any]]:
    stocks = str(body.get("stocks", "")).split(",")
    triggers = str(body.get("trigger_prices", "")).split(",")
    action = str(body.get("action", "BUY")).upper()
    out: list[dict[str, Any]] = []
    for i, s in enumerate(stocks):
        s = s.strip().upper()
        if not s:
            continue
        price = 0.0
        if i < len(triggers) and triggers[i].strip():
            try:
                price = float(triggers[i].strip())
            except ValueError:
                price = 0.0
        out.append(
            {
                "strategy": "chartink",
                "symbol": s,
                "action": action,
                "qty": 1.0,
                "price": price,
                "ordertype": "LIMIT" if price > 0 else "MARKET",
                "exchange": "NSE",
                "product": "CNC",
                "token": _opt_token(body),
            }
        )
    return out


def normalize_python(body: dict[str, Any]) -> dict[str, Any]:
    return {
        "strategy": str(body.get("strategy", "python")),
        "symbol": str(body.get("symbol", "")).upper(),
        "action": str(body.get("action", "")).upper(),
        "qty": float(body.get("qty") or body.get("quantity") or 0),
        "price": float(body.get("price") or 0),
        "ordertype": str(body.get("ordertype", "MARKET")).upper(),
        "exchange": str(body.get("exchange", "NFO")).upper(),
        "product": str(body.get("product", "MIS")).upper(),
        "token": _opt_token(body),
    }


def to_place_order_payload(norm: dict[str, Any]) -> dict[str, Any]:
    return {
        "symbol": norm["symbol"],
        "exchange": norm.get("exchange", "NSE"),
        "action": norm["action"],
        "quantity": int(norm["qty"]),
        "price": norm.get("price") or 0,
        "order_type": norm.get("ordertype", "MARKET"),
        "product": norm.get("product", "CNC"),
        "strategy": norm.get("strategy", ""),
        "token": norm.get("token"),
    }
