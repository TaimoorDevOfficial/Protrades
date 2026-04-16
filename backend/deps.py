from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from config import get_settings
from database import get_db
from models import BrokerSession
from security import safe_decode_token

security = HTTPBearer(auto_error=False)


async def get_broker_session(
    creds: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> BrokerSession | None:
    settings = get_settings()
    if not creds:
        if settings.public_mode:
            return db.query(BrokerSession).order_by(BrokerSession.id.desc()).first()
        return None
    payload = safe_decode_token(settings, creds.credentials)
    if not payload or "sid" not in payload:
        if settings.public_mode:
            return db.query(BrokerSession).order_by(BrokerSession.id.desc()).first()
        return None
    sid = int(payload["sid"])
    return db.get(BrokerSession, sid)


async def require_session(
    session: BrokerSession | None = Depends(get_broker_session),
) -> BrokerSession:
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return session
