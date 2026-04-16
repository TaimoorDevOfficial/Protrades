import hashlib
from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx

from config import Settings


def _unwrap_list(resp: Any, prefer: str | None = None) -> list:
    """Vortex often returns { status, data: { holdings: [...] } } or a bare list."""
    if isinstance(resp, list):
        return resp
    if not isinstance(resp, dict):
        return []
    if prefer:
        data = resp.get("data")
        if isinstance(data, dict) and isinstance(data.get(prefer), list):
            return data[prefer]
        if isinstance(resp.get(prefer), list):
            return resp[prefer]
    data = resp.get("data")
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for k in ("holdings", "positions", "orders", "trades", "rows"):
            if isinstance(data.get(k), list):
                return data[k]
    for k in ("holdings", "positions", "orders", "trades"):
        if isinstance(resp.get(k), list):
            return resp[k]
    return []


def _unwrap_dict(resp: Any) -> dict[str, Any]:
    if isinstance(resp, dict):
        data = resp.get("data")
        if isinstance(data, dict):
            return data
        if not resp.get("status"):
            return resp
        return resp
    return {}


def extract_access_token(login_response: dict[str, Any]) -> str:
    data = login_response.get("data") or {}
    return (
        str(data.get("access_token") or "")
        or str(login_response.get("access_token") or "")
        or str(login_response.get("token") or "")
    )


def map_norm_exchange_to_vortex(norm: dict[str, Any]) -> str:
    ex = str(norm.get("exchange") or "NSE").upper()
    sym = str(norm.get("symbol") or "").upper()
    if ex in ("NFO", "NSE_FO"):
        return "NSE_FO"
    if ex == "BSE":
        return "BSE_EQ"
    if ex in ("MCX", "MCX_FO"):
        return "MCX_FO"
    if ex in ("CDS", "NSE_CD"):
        return "NSE_CD"
    if ex == "NSE":
        if len(sym) > 12 or sym.endswith("CE") or sym.endswith("PE"):
            return "NSE_FO"
        return "NSE_EQ"
    return ex if ex in ("NSE_EQ", "BSE_EQ", "NSE_FO", "BSE_FO", "MCX_FO", "NSE_CD") else "NSE_EQ"


def map_product(norm_product: str) -> str:
    p = norm_product.upper()
    if p in ("MIS", "INTRADAY"):
        return "INTRADAY"
    if p in ("CNC", "NRML", "DELIVERY"):
        return "DELIVERY"
    if p == "MTF":
        return "MTF"
    return "DELIVERY"


class RupeezzyClient:
    """Rupeezy Vortex HTTP client (see vortex_api Python SDK / official docs)."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.base = settings.rupeezzy_base.rstrip("/")

    def _auth_headers(self, access_token: str) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _unauth_headers(self, x_api_key: str) -> dict[str, str]:
        return {
            "x-api-key": x_api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def login_retail(
        self,
        *,
        application_id: str,
        x_api_key: str,
        client_code: str,
        password: str,
        totp: str,
    ) -> dict[str, Any]:
        if self.settings.rupeezzy_mock:
            return {
                "status": "success",
                "data": {
                    "access_token": "mock-token",
                    "expires_in": 86400,
                },
            }
        payload = {
            "client_code": client_code.strip(),
            "password": password,
            "totp": str(totp).strip(),
            "application_id": application_id.strip(),
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(
                f"{self.base}/user/login",
                headers=self._unauth_headers(x_api_key),
                json=payload,
            )
            r.raise_for_status()
            return r.json()

    async def exchange_session_token(
        self,
        *,
        application_id: str,
        x_api_key: str,
        auth_code: str,
    ) -> dict[str, Any]:
        """Partner / SSO flow: exchange auth code from https://flow.rupeezy.in (checksum per Vortex SDK)."""
        raw = f"{application_id}{auth_code}{x_api_key}"
        checksum = hashlib.sha256(raw.encode("utf-8")).hexdigest()
        body = {
            "token": auth_code,
            "applicationId": application_id,
            "checksum": checksum,
        }
        if self.settings.rupeezzy_mock:
            return {"status": "success", "data": {"access_token": "mock-token-sso", "expires_in": 86400}}
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(
                f"{self.base}/user/session",
                headers=self._unauth_headers(x_api_key),
                json=body,
            )
            r.raise_for_status()
            return r.json()

    async def _get(self, path: str, access_token: str) -> Any:
        if self.settings.rupeezzy_mock:
            return self._mock_get(path)
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.get(f"{self.base}{path}", headers=self._auth_headers(access_token))
            r.raise_for_status()
            ct = r.headers.get("content-type", "")
            if "application/json" in ct:
                return r.json()
            return r.text

    async def _get_quote_ltp(self, access_token: str, exchange: str, token_id: int) -> float | None:
        if self.settings.rupeezzy_mock:
            return 100.0
        inst = f"{exchange}-{token_id}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.get(
                f"{self.base}/data/quotes",
                headers=self._auth_headers(access_token),
                params=[("q", inst), ("mode", "ltp")],
            )
            r.raise_for_status()
            data = r.json()
        # Response is instrument-keyed map of quote objects
        if isinstance(data, dict):
            q = data.get("data") or data
            if isinstance(q, dict) and inst in q:
                row = q[inst]
                if isinstance(row, dict):
                    v = row.get("ltp") or row.get("last_price")
                    if v is not None:
                        return float(v)
        return None

    async def quotes_ltp(self, access_token: str, instruments: list[str]) -> dict[str, float]:
        """
        Fetch LTP for up to ~1000 instruments in one call.
        instruments items must be like "NSE_EQ-2885".
        Returns map instrument->ltp.
        """
        if self.settings.rupeezzy_mock:
            return {inst: 100.0 for inst in instruments}
        if not instruments:
            return {}
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.get(
                f"{self.base}/data/quotes",
                headers=self._auth_headers(access_token),
                params=[("q", inst) for inst in instruments] + [("mode", "ltp")],
            )
            r.raise_for_status()
            data = r.json()
        out: dict[str, float] = {}
        if isinstance(data, dict):
            q = data.get("data") or data
            if isinstance(q, dict):
                for inst, row in q.items():
                    if isinstance(row, dict):
                        v = row.get("ltp") or row.get("last_price")
                        if v is not None:
                            try:
                                out[str(inst)] = float(v)
                            except (TypeError, ValueError):
                                pass
        return out

    async def day_open_price(self, access_token: str, exchange: str, token_id: int, day: date | None = None) -> float | None:
        """
        Fetch today's open price using Vortex historical candles endpoint.
        We request 1D candle from start-of-day to now and take the first candle open.
        """
        if self.settings.rupeezzy_mock:
            return 95.0
        d = day or datetime.now(timezone.utc).date()
        # Vortex expects epoch seconds for from/to. Use UTC boundaries; for NSE this is close enough for daily candle open.
        start = datetime(d.year, d.month, d.day, 0, 0, 0, tzinfo=timezone.utc)
        end = datetime.now(timezone.utc) + timedelta(minutes=5)
        params = {
            "exchange": exchange,
            "token": token_id,
            "from": int(start.timestamp()),
            "to": int(end.timestamp()),
            "resolution": "1D",
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.get(f"{self.base}/data/history", headers=self._auth_headers(access_token), params=params)
            r.raise_for_status()
            data = r.json()
        # Common shapes: {"status":"success","data":{"candles":[[ts,o,h,l,c,v],...]}}
        if isinstance(data, dict):
            inner = data.get("data") if isinstance(data.get("data"), dict) else data
            candles = None
            if isinstance(inner, dict):
                candles = inner.get("candles") or inner.get("CANDLES")
            if isinstance(candles, list) and candles:
                first = candles[0]
                if isinstance(first, (list, tuple)) and len(first) >= 2:
                    try:
                        return float(first[1])
                    except (TypeError, ValueError):
                        return None
        return None

    async def holdings(self, access_token: str) -> Any:
        raw = await self._get("/trading/portfolio/holdings", access_token)
        return _unwrap_list(raw, "holdings")

    async def positions(self, access_token: str) -> Any:
        raw = await self._get("/trading/portfolio/positions", access_token)
        return _unwrap_list(raw, "positions")

    async def orders(self, access_token: str) -> Any:
        raw = await self._get("/trading/orders?limit=50&offset=1", access_token)
        return _unwrap_list(raw, "orders")

    async def funds(self, access_token: str) -> Any:
        raw = await self._get("/user/funds", access_token)
        merged = _unwrap_dict(raw)
        # Normalize keys for dashboard / risk code
        if "available" not in merged and merged:
            for k in ("available_balance", "available_cash", "net_available", "clear_balance"):
                if k in merged:
                    merged = {**merged, "available": merged[k]}
                    break
        return merged if merged else raw

    async def place_order(self, access_token: str, payload: dict[str, Any]) -> dict[str, Any]:
        """
        Low-level Vortex place order. Payload must match POST /trading/orders/regular
        (exchange, token, transaction_type, product, variety, quantity, price, ...).
        """
        if self.settings.rupeezzy_mock:
            return {
                "status": "success",
                "data": {"order_id": f"MOCK-{datetime.now(timezone.utc).timestamp()}"},
            }
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(
                f"{self.base}/trading/orders/regular",
                headers=self._auth_headers(access_token),
                json=payload,
            )
            r.raise_for_status()
            return r.json() if r.content else {"status": "success"}

    async def place_order_from_norm(self, access_token: str, norm: dict[str, Any]) -> dict[str, Any]:
        """Build Vortex order from normalized webhook payload + instrument master."""
        from services.vortex_instruments import resolve_instrument_token

        vortex_ex = map_norm_exchange_to_vortex(norm)
        ord_type = str(norm.get("ordertype") or "MARKET").upper()
        action = str(norm.get("action") or "").upper()
        qty = int(norm["qty"])
        price_in = float(norm.get("price") or 0)

        token_override = norm.get("token")
        token_id: int | None = None
        if token_override is not None and str(token_override).strip() != "":
            try:
                token_id = int(float(token_override))
            except ValueError:
                token_id = None
        if token_id is None:
            if self.settings.rupeezzy_mock:
                token_id = 2885
            else:
                token_id = await resolve_instrument_token(vortex_ex, str(norm.get("symbol") or ""))
        if token_id is None:
            raise ValueError(
                f"Could not resolve Vortex instrument token for {vortex_ex} {norm.get('symbol')!r}. "
                "For derivatives, pass integer \"token\" in the webhook JSON (from master.csv), or use cash equities on NSE/BSE."
            )

        product = map_product(str(norm.get("product") or "CNC"))
        if ord_type in ("MARKET", "MKT"):
            variety = "RL-MKT"
            ltp = await self._get_quote_ltp(access_token, vortex_ex, token_id)
            price = float(ltp) if ltp is not None else (price_in if price_in > 0 else 0.0)
            if price <= 0:
                raise ValueError("Market order needs a non-zero last price (quote) or pass a positive \"price\" in the webhook body.")
        else:
            variety = "RL"
            price = price_in
            if price <= 0:
                raise ValueError("Limit order requires price > 0")

        validity = "DAY"
        validity_days = 1
        is_amo = False

        body = {
            "exchange": vortex_ex,
            "token": token_id,
            "transaction_type": action,
            "product": product,
            "variety": variety,
            "quantity": qty,
            "price": price,
            "trigger_price": 0.0,
            "disclosed_quantity": 0,
            "validity": validity,
            "validity_days": validity_days,
            "is_amo": is_amo,
        }
        return await self.place_order(access_token, body)

    def sample_portfolio(self) -> tuple[Any, Any, Any, Any]:
        """Static demo data for guest mode and tests (same shapes as mock API)."""
        return (
            self._mock_get("/holdings"),
            self._mock_get("/positions"),
            self._mock_get("/orders"),
            self._mock_get("/funds"),
        )

    def _mock_get(self, path: str) -> Any:
        if path.startswith("/holdings") or "holdings" in path:
            return [
                {
                    "symbol": "RELIANCE",
                    "quantity": 10,
                    "avg_price": 2450.5,
                    "ltp": 2480.0,
                    "pnl": 295.0,
                    "pnl_percent": 1.2,
                }
            ]
        if path.startswith("/positions") or "positions" in path:
            return [
                {
                    "symbol": "NIFTY24APR22000CE",
                    "quantity": 50,
                    "product": "MIS",
                    "pnl": -1200.0,
                    "exchange": "NFO",
                }
            ]
        if path.startswith("/orders") or "orders" in path:
            return [
                {
                    "order_id": "ORD-001",
                    "symbol": "INFY",
                    "status": "COMPLETE",
                    "side": "BUY",
                    "quantity": 5,
                },
                {
                    "order_id": "ORD-002",
                    "symbol": "TCS",
                    "status": "PENDING",
                    "side": "SELL",
                    "quantity": 2,
                },
            ]
        if path.startswith("/funds") or path.endswith("/funds"):
            return {"available": 250000.0, "utilized": 50000.0, "collateral": 0.0}
        return {}


async def nse_corporate_actions() -> list[dict[str, Any]]:
    """
    Pull corporate actions from NSE public endpoint.
    Note: NSE may rate-limit; we keep this best-effort and non-fatal.
    """
    url = "https://www.nseindia.com/api/corporates-corporateActions?index=equities"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
        "Accept": "application/json,text/plain,*/*",
        "Referer": "https://www.nseindia.com/",
    }
    async with httpx.AsyncClient(timeout=30.0, headers=headers, follow_redirects=True) as client:
        try:
            # NSE often needs a homepage hit first for cookies
            await client.get("https://www.nseindia.com/")
            r = await client.get(url)
            r.raise_for_status()
            data = r.json()
            if isinstance(data, dict) and isinstance(data.get("data"), list):
                return [x for x in data["data"] if isinstance(x, dict)]
            if isinstance(data, list):
                return [x for x in data if isinstance(x, dict)]
        except Exception:
            return []
    return []


def compute_expiry(login_response: dict[str, Any]) -> datetime | None:
    data = login_response.get("data") if isinstance(login_response.get("data"), dict) else {}
    exp = (
        data.get("expires_at")
        or data.get("expires_in")
        or login_response.get("expires_at")
        or login_response.get("expires_in")
    )
    if isinstance(exp, (int, float)):
        return datetime.now(timezone.utc) + timedelta(seconds=float(exp))
    if isinstance(exp, str):
        try:
            return datetime.fromisoformat(exp.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def vortex_order_id(resp: dict[str, Any]) -> str:
    data = resp.get("data") if isinstance(resp.get("data"), dict) else {}
    return str(
        data.get("order_id")
        or data.get("orderId")
        or resp.get("order_id")
        or resp.get("orderId")
        or ""
    )
