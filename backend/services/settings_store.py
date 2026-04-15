import json
from typing import Any

from sqlalchemy.orm import Session

from config import Settings, get_settings
from models import SettingsKV
from security import decrypt_value, encrypt_value, generate_protrades_api_key


def get_setting(db: Session, key: str, default: str | None = None) -> str | None:
    row = db.get(SettingsKV, key)
    if not row:
        return default
    settings = get_settings()
    try:
        return decrypt_value(settings, row.value)
    except Exception:
        return row.value


def set_setting(db: Session, key: str, value: str, encrypt: bool = False) -> None:
    settings = get_settings()
    stored = encrypt_value(settings, value) if encrypt else value
    row = db.get(SettingsKV, key)
    if row:
        row.value = stored
    else:
        db.add(SettingsKV(key=key, value=stored))
    db.commit()


def get_json_setting(db: Session, key: str, default: Any) -> Any:
    raw = get_setting(db, key)
    if not raw:
        return default
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return default


def ensure_protrades_api_key(db: Session) -> str:
    key = get_setting(db, "protrades_api_key")
    if key:
        return key
    key = generate_protrades_api_key()
    set_setting(db, "protrades_api_key", key, encrypt=False)
    return key


def get_risk_dict(db: Session) -> dict[str, Any]:
    base = {
        "max_order_value": 100_000.0,
        "symbol_whitelist": [],
        "daily_loss_limit_pct": 5.0,
        "paper_trading": False,
        "webhooks_disabled": False,
    }
    raw = get_setting(db, "risk_config")
    if raw:
        try:
            merged = {**base, **json.loads(raw)}
            return merged
        except json.JSONDecodeError:
            pass
    return base


def save_risk_dict(db: Session, data: dict[str, Any]) -> None:
    set_setting(db, "risk_config", json.dumps(data), encrypt=False)
