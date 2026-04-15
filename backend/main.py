from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from database import init_db
from routes import auth, logs_api, orders, probot, settings_api, webhooks


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="ProTrades API", version="1.0.0", lifespan=lifespan)

_settings = get_settings()
_origins = [o.strip() for o in _settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(orders.router, prefix="/api")
app.include_router(settings_api.router, prefix="/api")
app.include_router(logs_api.router, prefix="/api")
app.include_router(probot.router, prefix="/api")
app.include_router(webhooks.router, prefix="/webhook")


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "protrades"}


@app.get("/api/webhook-urls")
def webhook_urls():
    base = get_settings().public_app_url.rstrip("/")
    return {
        "amibroker": f"{base}/webhook/amibroker",
        "tradingview": f"{base}/webhook/tradingview",
        "chartink": f"{base}/webhook/chartink",
        "python": f"{base}/webhook/python",
    }
