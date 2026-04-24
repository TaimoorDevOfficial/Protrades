from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from config import get_settings
from database import init_db
from routes import auth, intel, market, orders, probot, settings_api, webhooks
from routes.trade import router as trade_router
from pathlib import Path


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
app.include_router(probot.router, prefix="/api")
app.include_router(market.router, prefix="/api")
app.include_router(intel.router, prefix="/api")
app.include_router(trade_router, prefix="/api")
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


_FRONTEND_DIST = (Path(__file__).resolve().parent / "frontend_dist").resolve()
_FRONTEND_ASSETS = (_FRONTEND_DIST / "assets").resolve()
if _FRONTEND_ASSETS.exists():
    app.mount("/assets", StaticFiles(directory=str(_FRONTEND_ASSETS)), name="assets")


@app.get("/{full_path:path}")
def spa_fallback(full_path: str):
    """
    Single-service deploy: serve React SPA index.html for non-API routes.
    This is only active when frontend build exists in backend/frontend_dist.
    """
    if not _FRONTEND_DIST.exists():
        raise HTTPException(status_code=404, detail="not found")
    if full_path.startswith("api") or full_path.startswith("webhook"):
        raise HTTPException(status_code=404, detail="not found")

    # Serve real files (favicon, manifest, etc.) when present
    target = (_FRONTEND_DIST / full_path).resolve() if full_path else None
    if target and str(target).startswith(str(_FRONTEND_DIST)) and target.is_file():
        return FileResponse(str(target))

    index = (_FRONTEND_DIST / "index.html").resolve()
    if index.exists():
        return FileResponse(str(index))
    raise HTTPException(status_code=404, detail="not found")
