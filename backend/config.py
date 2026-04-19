from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Load .env from repo root and/or backend/ (later file wins). CWD alone misses ../.env when
# running uvicorn from backend/. Railway/Docker: set vars in the platform — .env may not ship.
_backend_dir = Path(__file__).resolve().parent
_repo_root = _backend_dir.parent
_env_files: tuple[str, ...] = tuple(
    str(p)
    for p in (_repo_root / ".env", _backend_dir / ".env")
    if p.is_file()
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_env_files if _env_files else None,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    protrades_secret: str = "change-me-in-production-use-long-random-string"
    database_url: str = "sqlite:///./protrades.db"  # override with DATABASE_URL
    rupeezzy_base: str = "https://vortex-api.rupeezy.in/v2"
    rupeezzy_mock: bool = False
    vortex_application_id: str = ""
    vortex_x_api_key: str = ""
    public_mode: bool = False
    claude_key: str = ""
    claude_model: str = "claude-sonnet-4-20250514"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    public_app_url: str = "https://app.protrades.in"
    # NSE often returns 403 from cloud/datacenter IPs. Optional: paste JSON array from browser into this file.
    nse_ca_fallback_json_path: str = ""
    # Optional: copy Cookie header from a logged-in browser session on nseindia.com (may reduce 403).
    nse_ca_cookie: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
