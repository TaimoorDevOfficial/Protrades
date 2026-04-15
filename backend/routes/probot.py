import json
from datetime import datetime, timezone

import pytz
from anthropic import Anthropic
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import get_settings
from database import get_db
from deps import get_broker_session
from models import BrokerSession, ChatHistory, Watchlist
from services.settings_store import get_json_setting, get_setting, set_setting

router = APIRouter(prefix="/probot", tags=["probot"])

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


def _system_prompt(
    db: Session,
    session: BrokerSession | None,
) -> str:
    today = datetime.now(IST).strftime("%Y-%m-%d %H:%M IST")
    watch = db.query(Watchlist).all()
    watch_syms = ", ".join(w.symbol for w in watch[:50]) or "(empty)"
    holdings = "[]"
    if session and session.holdings_json:
        holdings = session.holdings_json
    return f"""You are ProBot, the AI market assistant for ProTrades — a professional algo trading platform for Indian markets.
You have access to web search. Today's date is {today}.

Your job:
1. MARKET UPDATES: Summarize Nifty/Sensex/BankNifty movement from 8AM to current time. Mention key movers, sector trends, and notable events.
2. CORPORATE ACTIONS: For stocks in the user's watchlist [{watch_syms}] and holdings [{holdings}], flag upcoming dividends, splits, bonus, rights issues, buybacks, and earnings dates.
3. BUY/SELL FIGURES: Report FII/DII buy-sell data, delivery volumes for held stocks, and unusual options activity.
4. USER QUERIES: Answer any trading/market question clearly and concisely.

Always cite your source. Use ₹ with Indian number formatting (lakhs/crores).
Market hours: Pre-open 9:00–9:15 AM, Regular 9:15 AM–3:30 PM, Closing 3:30–4:00 PM IST.
Outside hours: Show last close summary and next-day outlook.
Sign off responses with: "— ProBot, ProTrades"
"""


@router.post("/chat")
def probot_chat(body: ChatBody, db: Session = Depends(get_db), broker: BrokerSession | None = Depends(get_broker_session)):
    settings = get_settings()
    api_key = settings.claude_key or get_setting(db, "claude_key_store")
    if not api_key:
        raise HTTPException(status_code=503, detail="Configure CLAUDE_KEY or add Anthropic key in Settings.")

    client = Anthropic(api_key=api_key)
    sys = _system_prompt(db, broker)

    msgs = [{"role": m.role, "content": m.content} for m in body.messages if m.content.strip()]
    if not msgs:
        raise HTTPException(status_code=400, detail="No messages")

    tools = [{"type": "web_search_20250305", "name": "web_search", "max_uses": 5}]

    try:
        response = client.messages.create(
            model=settings.claude_model,
            max_tokens=4096,
            system=sys,
            messages=msgs,
            tools=tools,
        )
    except Exception:
        response = client.messages.create(
            model=settings.claude_model,
            max_tokens=4096,
            system=sys,
            messages=msgs,
        )

    parts = []
    for block in response.content:
        if hasattr(block, "text"):
            parts.append(block.text)
    text = "\n".join(parts).strip()

    user_msg = body.messages[-1].content if body.messages else ""
    db.add(ChatHistory(session_id=body.session_id, role="user", content=user_msg))
    db.add(ChatHistory(session_id=body.session_id, role="assistant", content=text))
    db.commit()

    return {"reply": text, "model": settings.claude_model}


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
    """Lightweight canned line; full briefing via /chat quick action."""
    return {
        "text": "Good morning! Here's your ProTrades market preview — tap ProBot for a live briefing with web sources.",
    }
