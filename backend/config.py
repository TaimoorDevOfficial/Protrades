from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

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


@lru_cache
def get_settings() -> Settings:
    return Settings()
