from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from deps import require_session
from models import WebhookLog

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("")
def list_logs(
    db: Session = Depends(get_db),
    _: None = Depends(require_session),
    q: str | None = Query(default=None),
    limit: int = Query(default=100, le=500),
):
    query = db.query(WebhookLog).order_by(WebhookLog.timestamp.desc())
    if q:
        like = f"%{q}%"
        query = query.filter(
            (WebhookLog.symbol.ilike(like))
            | (WebhookLog.source.ilike(like))
            | (WebhookLog.status.ilike(like))
        )
    rows = query.limit(limit).all()
    return [
        {
            "id": r.id,
            "timestamp": r.timestamp.isoformat(),
            "source": r.source,
            "symbol": r.symbol,
            "action": r.action,
            "qty": r.qty,
            "status": r.status,
            "order_id": r.order_id,
            "message": r.message,
        }
        for r in rows
    ]
