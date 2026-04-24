import logging
from datetime import datetime

import pytz
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import get_settings
from database import get_db
from deps import get_broker_session
from models import BrokerSession, ChatHistory, Watchlist
from routes.market import build_market_brief_payload
from services.nse_ca import symbol_from_ca_row
from services.settings_store import get_setting, set_setting

router = APIRouter(prefix="/probot", tags=["probot"])
logger = logging.getLogger(__name__)

IST = pytz.timezone("Asia/Kolkata")


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatBody(BaseModel):
    session_id: str = "default"
    messages: list[ChatMessage]


def _format_inr(n: float) -> str:
    if abs(n) >= 1e7:
        return f"₹{n/1e7:.2f} Cr"
    if abs(n) >= 1e5:
        return f"₹{n/1e5:.2f} L"
    return f"₹{n:,.2f}"


def _fmt_px(n: float | None) -> str:
    if n is None:
        return "—"
    return f"₹{float(n):,.2f}"


def _format_holdings_lines(rows: list[dict], limit: int = 30) -> list[str]:
    lines: list[str] = []
    for r in rows[:limit]:
        sym = str(r.get("symbol") or "")
        src = str(r.get("source") or "")
        ltp = r.get("ltp")
        pct = r.get("day_change_pct")
        pnl = r.get("pnl")
        parts = [f"• {sym} ({src}): LTP {_fmt_px(ltp)}"]
        if pct is not None:
            parts.append(f"day {float(pct):+.2f}%")
        if src == "holding" and pnl is not None:
            parts.append(f"position P&L {_format_inr(float(pnl))}")
        lines.append(" ".join(parts))
    if len(rows) > limit:
        lines.append(f"… and {len(rows) - limit} more (see Market page for full list).")
    return lines


def _format_ca_lines(rows: list[dict], limit: int = 15) -> list[str]:
    lines: list[str] = []
    for a in rows[:limit]:
        sym = str(a.get("symbol") or a.get("SYMBOL") or symbol_from_ca_row(a) or "—")
        subj = str(a.get("subject") or a.get("SUBJECT") or a.get("purpose") or "—")[:140]
        exd = str(a.get("exDate") or a.get("ex_date") or a.get("EXDATE") or "—")
        rd = str(a.get("recordDate") or a.get("record_date") or a.get("RECORDDATE") or "—")
        lines.append(f"• {sym}: {subj} (ex {exd}, record {rd})")
    if len(rows) > limit:
        lines.append(f"… and {len(rows) - limit} more rows.")
    return lines


def _snapshot_text_for_llm(snapshot: dict, max_rows: int = 25, max_ca: int = 15) -> str:
    """Compact block injected into Claude system prompt (authoritative numbers)."""
    lines: list[str] = [
        "LIVE DATA from ProTrades (Rupeezy/Vortex quotes + NSE corporate actions filtered to portfolio) — prefer these over guessing:",
    ]
    hold = snapshot.get("holdings") or []
    if hold:
        lines.append("Holdings / watchlist snapshot:")
        lines.extend(_format_holdings_lines(hold, limit=max_rows))
    else:
        lines.append("Holdings / watchlist snapshot: (empty — user should add watchlist or sync holdings).")
    cas = snapshot.get("corporate_actions") or []
    lines.append("")
    if cas:
        lines.append("Corporate actions (portfolio filter):")
        lines.extend(_format_ca_lines(cas, limit=max_ca))
    else:
        lines.append("Corporate actions: none matched portfolio (or NSE feed unavailable).")
    return "\n".join(lines)


def _intent_hint(user_text_lower: str) -> str | None:
    """Short extra line when the question goes beyond what offline data includes."""
    t = user_text_lower
    if any(k in t for k in ("nifty", "sensex", "bank nifty", "banknifty")):
        return (
            "Note: Nifty/Sensex/Bank Nifty index levels are not in your broker snapshot above — add an Anthropic API key for web-backed index and news."
        )
    if any(k in t for k in ("fii", "dii", "foreign institutional")):
        return "Note: FII/DII flows are not in the Rupeezy snapshot; use Intel or enable AI + web search for flow headlines."
    if any(k in t for k in ("corporate action", "dividend", "split", "bonus", "rights", "buyback")) and "verify" not in t:
        return "Always verify ex-date and record date on the exchange circular before acting on corporate events."
    if any(k in t for k in ("risk", "stop loss", "position size")):
        return "Risk reminder: size trades to max loss per idea; avoid single-name concentration."
    return None


def _offline_data_reply(user_text: str, snapshot: dict | None, broker: BrokerSession | None) -> str:
    """
    No LLM key: answer from Rupeezy/Vortex snapshot + NSE CA already loaded in Market,
    plus short rule-based hints when relevant.
    """
    ut = (user_text or "").lower().strip()
    blocks: list[str] = []

    if broker is not None and snapshot is not None:
        rows = snapshot.get("holdings") or []
        if rows:
            blocks.append("Your snapshot (offline — same Rupeezy/Vortex data as the Market page):")
            blocks.extend(_format_holdings_lines(rows))
        else:
            blocks.append(
                "No symbols in your snapshot yet — add a watchlist entry or sync holdings to see LTP and day change."
            )

        blocks.append("")
        cas = snapshot.get("corporate_actions") or []
        if cas:
            blocks.append("Corporate actions — NSE feed filtered to your holdings + watchlist:")
            blocks.extend(_format_ca_lines(cas))
        else:
            blocks.append(
                "Corporate actions: none matched your portfolio, or the NSE feed was empty/blocked from this server."
            )
    elif broker is not None and snapshot is None:
        blocks.append(
            "Could not load live snapshot (token or network). Refresh the Market page and try again."
        )
    else:
        blocks.append(
            "No broker session — log in with Rupeezy/Vortex so ProTrades can attach your live LTP, day %, and P&L."
        )

    hint = _intent_hint(ut)
    if hint:
        blocks.append("")
        blocks.append(hint)

    blocks.append("")
    blocks.append("Add OPENAI_KEY in the server `.env` or Settings for AI analysis and deeper commentary.")
    blocks.append("— ProBot, ProTrades")
    return "\n".join(blocks)


def _system_prompt(
    db: Session,
    session: BrokerSession | None,
    live_snapshot: dict | None = None,
) -> str:
    today = datetime.now(IST).strftime("%Y-%m-%d %H:%M IST")
    watch = db.query(Watchlist).all()
    watch_syms = ", ".join(w.symbol for w in watch[:50]) or "(empty)"
    holdings = "[]"
    if session and session.holdings_json:
        holdings = session.holdings_json

    snap_block = ""
    if live_snapshot is not None:
        snap_block = "\n\n" + _snapshot_text_for_llm(live_snapshot) + "\n"
        snap_block += (
            "\nUse the LIVE DATA block above for prices, day %, P&L, and corporate actions tied to this user. "
            "Interpret and explain it; do not replace it with guesses. For broad indices (Nifty/Sensex) or news, use web search.\n"
        )

    return f"""You are ProBot, the AI market assistant for ProTrades — a professional algo trading platform for Indian markets.
Today's date is {today}.
{snap_block}
Your job:
1. USER'S BOOK: Start from the LIVE DATA block when present — analyze moves, P&L, and corporate actions for their symbols.
2. MARKET CONTEXT: Where helpful, summarize Nifty/Sensex/Bank Nifty and themes (do not claim web sources unless the user provides them).
3. CORPORATE ACTIONS: Cross-check filings/news for timing; the LIVE DATA list is filtered to their portfolio.
4. USER QUERIES: Answer trading/market questions clearly. Distinguish facts (from LIVE DATA or cited web) from opinion.

Watchlist symbols: [{watch_syms}]. Raw holdings JSON (broker sync): {holdings}

Do not invent sources. Use ₹ with Indian number formatting (lakhs/crores).
Market hours: Pre-open 9:00–9:15 AM, Regular 9:15 AM–3:30 PM, Closing 3:30–4:00 PM IST.
Outside hours: Note session vs last close where relevant.
Sign off responses with: "— ProBot, ProTrades"
"""


@router.post("/chat")
async def probot_chat(
    body: ChatBody,
    db: Session = Depends(get_db),
    broker: BrokerSession | None = Depends(get_broker_session),
):
    settings = get_settings()
    api_key = settings.openai_key or get_setting(db, "openai_key_store")

    msgs = [{"role": m.role, "content": m.content} for m in body.messages if m.content.strip()]
    if not msgs:
        raise HTTPException(status_code=400, detail="No messages")

    user_msg = body.messages[-1].content if body.messages else ""

    live_snapshot: dict | None = None
    if broker is not None:
        try:
            live_snapshot = await build_market_brief_payload(broker, db=db)
        except Exception as e:
            logger.warning("probot: build_market_brief_payload failed: %s", e)

    if not api_key:
        text = _offline_data_reply(user_msg, live_snapshot, broker)
        db.add(ChatHistory(session_id=body.session_id, role="user", content=user_msg))
        db.add(ChatHistory(session_id=body.session_id, role="assistant", content=text))
        db.commit()
        return {"reply": text, "model": "rules-offline", "source": "rules-data"}

    sys = _system_prompt(db, broker, live_snapshot=live_snapshot)

    # OpenAI Chat Completions over raw HTTP (no extra dependency).
    payload = {
        "model": settings.openai_model,
        "messages": [{"role": "system", "content": sys}, *msgs],
        "temperature": 0.3,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=45.0) as client:
        r = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
        if not r.is_success:
            raise HTTPException(status_code=502, detail=f"OpenAI error: {r.status_code} {r.text[:400]}")
        data = r.json()
    try:
        text = str(data["choices"][0]["message"]["content"] or "").strip()
    except Exception:
        raise HTTPException(status_code=502, detail="OpenAI error: invalid response shape")

    db.add(ChatHistory(session_id=body.session_id, role="user", content=user_msg))
    db.add(ChatHistory(session_id=body.session_id, role="assistant", content=text))
    db.commit()

    return {"reply": text, "model": settings.openai_model, "source": "openai"}


class FeedbackBody(BaseModel):
    message_id: int | None = None
    rating: str


@router.post("/feedback")
def probot_feedback(body: FeedbackBody, db: Session = Depends(get_db)):
    if body.message_id:
        row = db.get(ChatHistory, body.message_id)
        if row:
            row.feedback = body.rating
            db.commit()
    return {"status": "ok"}


@router.get("/briefing-status")
def briefing_status(db: Session = Depends(get_db)):
    now = datetime.now(IST)
    date_key = now.strftime("%Y-%m-%d")
    last = get_setting(db, "morning_briefing_sent_date")
    should_show = now.hour >= 8 and last != date_key
    return {"should_show_auto_briefing": should_show, "date": date_key}


@router.post("/briefing/ack")
def briefing_ack(db: Session = Depends(get_db)):
    now = datetime.now(IST)
    set_setting(db, "morning_briefing_sent_date", now.strftime("%Y-%m-%d"), encrypt=False)
    return {"status": "ok"}


@router.get("/morning-preview")
def morning_preview(db: Session = Depends(get_db), broker: BrokerSession | None = Depends(get_broker_session)):
    """Lightweight canned line; full snapshot via ProBot /chat (offline data or AI)."""
    return {
        "text": "Good morning! Open ProBot for your snapshot from synced Rupeezy data (prices + corporate actions). Add an OpenAI key in Settings for AI analysis.",
    }
