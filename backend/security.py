import base64
import hashlib
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from cryptography.fernet import Fernet
from jose import JWTError, jwt

from config import Settings, get_settings


def _fernet(settings: Settings) -> Fernet:
    digest = hashlib.sha256(settings.protrades_secret.encode()).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_value(settings: Settings, raw: str) -> str:
    if not raw:
        return ""
    return _fernet(settings).encrypt(raw.encode()).decode()


def decrypt_value(settings: Settings, blob: str) -> str:
    if not blob:
        return ""
    return _fernet(settings).decrypt(blob.encode()).decode()


def create_access_token(settings: Settings, data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.protrades_secret, algorithm=settings.jwt_algorithm)


def decode_token(settings: Settings, token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.protrades_secret, algorithms=[settings.jwt_algorithm])


def safe_decode_token(settings: Settings, token: str) -> dict[str, Any] | None:
    try:
        return decode_token(settings, token)
    except JWTError:
        return None


def generate_protrades_api_key() -> str:
    return "pt_" + base64.urlsafe_b64encode(os.urandom(24)).decode().rstrip("=")
