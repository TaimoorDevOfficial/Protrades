import json
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import Settings, get_settings
from database import get_db
from deps import get_broker_session, require_session
from models import BrokerSession
from security import create_access_token, decrypt_value, encrypt_value
from services.rupeezzy import RupeezzyClient, compute_expiry, extract_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


def _jwt_expires_delta(settings: Settings, broker_expires_at: datetime | None) -> timedelta:
    """Match dashboard JWT lifetime to the broker token when possible."""
    default = timedelta(minutes=settings.access_token_expire_minutes)
    if not broker_expires_at:
        return default
    now = datetime.now(timezone.utc)
    exp = broker_expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    delta = exp - now
    if delta.total_seconds() < 300:
        return default
    cap = timedelta(days=60)
    return delta if delta <= cap else cap


class LoginBody(BaseModel):
    """Rupeezy Vortex retail login: application id + x-api-key + client credentials + TOTP."""

    client_code: str = ""
    password: str = ""
    totp: str = ""


class RupeezySsoBody(BaseModel):
    auth_code: str


class OAuthStart(BaseModel):
    redirect_uri: str | None = None


@router.post("/login")
async def login(body: LoginBody, db: Session = Depends(get_db)):
    settings = get_settings()
    client = RupeezzyClient(settings)
    app_id = (settings.vortex_application_id or "").strip()
    xkey = (settings.vortex_x_api_key or "").strip()
    if not app_id or not xkey:
        raise HTTPException(
            status_code=400,
            detail="Missing Vortex credentials in backend .env. Set VORTEX_APPLICATION_ID and VORTEX_X_API_KEY, restart backend.",
        )
    if not (body.client_code or "").strip() or not body.password or not (body.totp or "").strip():
        raise HTTPException(
            status_code=400,
            detail="Vortex login requires client_code, password, and totp.",
        )
    try:
        login_resp = await client.login_retail(
            application_id=app_id,
            x_api_key=xkey,
            client_code=body.client_code.strip(),
            password=body.password,
            totp=str(body.totp).strip(),
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=401,
            detail=f"Rupeezzy API error ({e.response.status_code}). Check API key/secret and Rupeezzy dashboard.",
        ) from e
    except (httpx.ConnectError, httpx.ConnectTimeout) as e:
        raise HTTPException(
            status_code=503,
            detail=(
                "Cannot reach Rupeezzy (network/DNS). "
                "Set RUPEEZZY_BASE in backend .env to the exact base URL from Rupeezzy's developer docs (no typos). "
                "Check internet, VPN, and firewall. "
                "Verify the hostname resolves: e.g. nslookup on the host part of the URL. "
                "For local UI testing without calling Rupeezzy, set RUPEEZZY_MOCK=1 and restart uvicorn."
            ),
        ) from e
    except Exception as e:
        err = str(e).lower()
        if "getaddrinfo" in err or "11001" in str(e) or "name or service not known" in err:
            raise HTTPException(
                status_code=503,
                detail=(
                    "DNS could not resolve the Rupeezzy API host. "
                    "Fix RUPEEZZY_BASE in .env (see Rupeezzy docs) or use RUPEEZZY_MOCK=1 for demo mode."
                ),
            ) from e
        raise HTTPException(status_code=401, detail=f"Rupeezzy login failed: {e!s}") from e

    token = extract_access_token(login_resp)
    if not token:
        raise HTTPException(status_code=401, detail="No access_token from Vortex — check credentials and application id.")

    expires_at = compute_expiry(login_resp)
    enc = encrypt_value(settings, token)

    db.query(BrokerSession).delete()
    db.commit()

    row = BrokerSession(
        rupeezzy_token=enc,
        expires_at=expires_at,
        label="rupeezzy",
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    try:
        holdings = await client.holdings(token)
        positions = await client.positions(token)
        orders = await client.orders(token)
        funds = await client.funds(token)
        row.holdings_json = json.dumps(holdings if isinstance(holdings, list) else holdings)
        row.positions_json = json.dumps(positions if isinstance(positions, list) else positions)
        row.orders_json = json.dumps(orders if isinstance(orders, list) else orders)
        row.funds_json = json.dumps(funds if isinstance(funds, dict) else {"data": funds})
        row.updated_at = datetime.now(timezone.utc)
        db.commit()
    except Exception:
        db.rollback()

    jwt = create_access_token(
        settings,
        {"sid": row.id, "sub": "protrades"},
        expires_delta=_jwt_expires_delta(settings, expires_at),
    )
    from services.settings_store import set_setting

    # Store for SSO token exchange convenience (optional)
    set_setting(db, "rupeezzy_api_key", app_id, encrypt=True)
    set_setting(db, "rupeezzy_api_secret", xkey, encrypt=True)

    return {
        "access_token": jwt,
        "token_type": "bearer",
        "expires_at": expires_at.isoformat() if expires_at else None,
        "broker": "rupeezzy",
    }


@router.post("/guest")
async def guest_login(db: Session = Depends(get_db)):
    """Demo session with sample portfolio data; no Rupeezzy credentials."""
    settings = get_settings()
    client = RupeezzyClient(settings)
    holdings, positions, orders, funds = client.sample_portfolio()

    db.query(BrokerSession).delete()
    db.commit()

    row = BrokerSession(
        rupeezzy_token=encrypt_value(settings, ""),
        expires_at=None,
        label="guest",
        holdings_json=json.dumps(holdings if isinstance(holdings, list) else holdings),
        positions_json=json.dumps(positions if isinstance(positions, list) else positions),
        orders_json=json.dumps(orders if isinstance(orders, list) else orders),
        funds_json=json.dumps(funds if isinstance(funds, dict) else {"data": funds}),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    jwt = create_access_token(settings, {"sid": row.id, "sub": "protrades", "guest": True})
    return {
        "access_token": jwt,
        "token_type": "bearer",
        "expires_at": None,
        "broker": "guest",
    }


@router.post("/relogin")
async def relogin(db: Session = Depends(get_db)):
    """Re-fetch portfolio using the stored Vortex access token (no new TOTP). If the token expired, log in again."""
    settings = get_settings()
    client = RupeezzyClient(settings)
    row = db.query(BrokerSession).order_by(BrokerSession.id.desc()).first()
    if not row or row.label == "guest":
        raise HTTPException(status_code=400, detail="No broker session — use /auth/login")
    tok = decrypt_value(settings, row.rupeezzy_token)
    if not tok:
        raise HTTPException(status_code=401, detail="Broker token missing — log in again with a fresh TOTP")
    try:
        holdings = await client.holdings(tok)
        positions = await client.positions(tok)
        orders = await client.orders(tok)
        funds = await client.funds(tok)
        row.holdings_json = json.dumps(holdings if isinstance(holdings, list) else holdings)
        row.positions_json = json.dumps(positions if isinstance(positions, list) else positions)
        row.orders_json = json.dumps(orders if isinstance(orders, list) else orders)
        row.funds_json = json.dumps(funds if isinstance(funds, dict) else {"data": funds})
        row.updated_at = datetime.now(timezone.utc)
        db.commit()
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Vortex session invalid or expired — log in again: {e!s}",
        ) from e
    return {"status": "ok", "updated_at": row.updated_at.isoformat() if row.updated_at else None}


@router.post("/refresh")
async def refresh_session(session: BrokerSession = Depends(require_session), db: Session = Depends(get_db)):
    settings = get_settings()
    if session.label == "guest":
        client = RupeezzyClient(settings)
        holdings, positions, orders, funds = client.sample_portfolio()
        session.holdings_json = json.dumps(holdings if isinstance(holdings, list) else holdings)
        session.positions_json = json.dumps(positions if isinstance(positions, list) else positions)
        session.orders_json = json.dumps(orders if isinstance(orders, list) else orders)
        session.funds_json = json.dumps(funds if isinstance(funds, dict) else {"data": funds})
        session.updated_at = datetime.now(timezone.utc)
        db.commit()
        return {"status": "ok", "updated_at": session.updated_at.isoformat()}

    client = RupeezzyClient(settings)
    token = decrypt_value(settings, session.rupeezzy_token)
    try:
        holdings = await client.holdings(token)
        positions = await client.positions(token)
        orders = await client.orders(token)
        funds = await client.funds(token)
        session.holdings_json = json.dumps(holdings if isinstance(holdings, list) else holdings)
        session.positions_json = json.dumps(positions if isinstance(positions, list) else positions)
        session.orders_json = json.dumps(orders if isinstance(orders, list) else orders)
        session.funds_json = json.dumps(funds if isinstance(funds, dict) else {"data": funds})
        session.updated_at = datetime.now(timezone.utc)
        db.commit()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Refresh failed: {e!s}") from e
    return {"status": "ok", "updated_at": session.updated_at.isoformat()}


@router.get("/oauth/rupeezzy/url")
async def rupeezzy_oauth_url(
    application_id: str | None = Query(default=None, description="Vortex application id (or rely on saved Settings)"),
    db: Session = Depends(get_db),
):
    """Official Vortex browser login (partner / SSO). User completes login; your redirect receives ?auth=... to exchange via POST /auth/rupeezzy/session."""
    from services.settings_store import get_setting

    # Prefer backend env, then query, then stored settings
    aid = (get_settings().vortex_application_id or "").strip() or (application_id or "").strip() or (get_setting(db, "rupeezzy_api_key") or "")
    if not aid:
        return {
            "url": "",
            "message": "Set VORTEX_APPLICATION_ID in backend .env (or save keys in Settings) before opening the Vortex flow URL.",
        }
    return {
        "url": f"https://flow.rupeezy.in?applicationId={aid}&cb_param=protrades",
        "message": "After redirect, POST the auth code to /api/auth/rupeezzy/session to complete SSO login.",
    }


@router.post("/rupeezzy/session")
async def rupeezzy_exchange_sso(body: RupeezySsoBody, db: Session = Depends(get_db)):
    """Exchange ?auth= code from https://flow.rupeezy.in (Vortex partner login). Requires stored x-api-key + application id in Settings."""
    from services.settings_store import get_setting

    settings = get_settings()
    app_id = (get_setting(db, "rupeezzy_api_key") or "").strip()
    xkey = (get_setting(db, "rupeezzy_api_secret") or "").strip()
    if not app_id or not xkey:
        raise HTTPException(status_code=400, detail="Save application id and x-api-key in Settings (or log in via retail once) first.")
    client = RupeezzyClient(settings)
    try:
        login_resp = await client.exchange_session_token(
            application_id=app_id,
            x_api_key=xkey,
            auth_code=body.auth_code.strip(),
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=401, detail=f"Vortex session exchange failed: {e.response.status_code}") from e
    except (httpx.ConnectError, httpx.ConnectTimeout) as e:
        raise HTTPException(status_code=503, detail=f"Cannot reach Vortex API: {e!s}") from e
    token = extract_access_token(login_resp)
    if not token:
        raise HTTPException(status_code=401, detail="No access_token from Vortex session exchange")

    expires_at = compute_expiry(login_resp)
    enc = encrypt_value(settings, token)
    db.query(BrokerSession).delete()
    db.commit()
    row = BrokerSession(
        rupeezzy_token=enc,
        expires_at=expires_at,
        label="rupeezzy",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    try:
        holdings = await client.holdings(token)
        positions = await client.positions(token)
        orders = await client.orders(token)
        funds = await client.funds(token)
        row.holdings_json = json.dumps(holdings if isinstance(holdings, list) else holdings)
        row.positions_json = json.dumps(positions if isinstance(positions, list) else positions)
        row.orders_json = json.dumps(orders if isinstance(orders, list) else orders)
        row.funds_json = json.dumps(funds if isinstance(funds, dict) else {"data": funds})
        row.updated_at = datetime.now(timezone.utc)
        db.commit()
    except Exception:
        db.rollback()

    jwt = create_access_token(
        settings,
        {"sid": row.id, "sub": "protrades"},
        expires_delta=_jwt_expires_delta(settings, expires_at),
    )
    return {
        "access_token": jwt,
        "token_type": "bearer",
        "expires_at": expires_at.isoformat() if expires_at else None,
        "broker": "rupeezzy",
    }


@router.get("/status")
async def auth_status(session: BrokerSession | None = Depends(get_broker_session)):
    return {
        "connected": session is not None,
        "broker": ("guest" if session and session.label == "guest" else "rupeezzy") if session else None,
        "expires_at": session.expires_at.isoformat() if session and session.expires_at else None,
    }
