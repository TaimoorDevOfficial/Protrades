# ProTrades — Setup Guide

ProTrades is a professional algorithmic trading dashboard for Indian markets: Rupeezzy integration, webhook bridge (AmiBroker, TradingView, ChartInk, Python), risk engine, and ProBot (Claude + web search).

**Tagline:** Trade Smarter. Execute Faster.

## Prerequisites

- Python 3.12+
- Node.js 20+ (for the SPA)
- Rupeezzy API credentials (set `RUPEEZZY_MOCK=1` for local UI without live broker)

## Quick start (development)

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy ..\.env.example ..\.env
# Edit .env — set PROTRADES_SECRET, CLAUDE_KEY (optional for ProBot), RUPEEZZY_MOCK=1
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`, log in with your Rupeezy client credentials (client code/password/TOTP).

## Docker

```bash
cp .env.example .env
docker compose up --build
```

- API: `http://localhost:8000`
- Web (nginx + static): `http://localhost:8080` (proxies `/api` and `/webhook` to the API container)

## Deploy on Railway (single GitHub repo, 2 services)

This repo is a monorepo. Deploy **two Railway services** from the **same** GitHub repository.

### Service 1: API (FastAPI)

- **Root directory**: `backend`
- **Expose port**: Railway sets `PORT`; the Dockerfile should bind to it, otherwise set `PORT=8000`
- **Variables** (minimum):
  - `PROTRADES_SECRET` = long random string
  - `DATABASE_URL` = use Railway Postgres (recommended)
  - `RUPEEZZY_BASE=https://vortex-api.rupeezy.in/v2`
  - `RUPEEZZY_MOCK=0` (live) or `1` (demo)
  - `VORTEX_APPLICATION_ID=...`
  - `VORTEX_X_API_KEY=...`
  - `PUBLIC_APP_URL` = your Railway **web** domain (used to show webhook URLs in UI)
  - `CORS_ORIGINS` = include your Railway **web** domain, e.g. `https://<your-web>.up.railway.app`

### Service 2: Web (React/Vite)

- **Root directory**: `frontend`
- **Build command**: `npm ci && npm run build`
- **Start command**: `npm run preview -- --host 0.0.0.0 --port $PORT`
- **Variables**:
  - `VITE_API_BASE_URL` = your Railway **api** domain, e.g. `https://<your-api>.up.railway.app`

Notes:
- The frontend uses `VITE_API_BASE_URL` to call the API across domains (required on Railway).
- If you change domains, update `CORS_ORIGINS` on the API service.

## Deploy on Railway (single service / single deploy)

If you want **one Railway service** for both backend + frontend, this repo includes a **root `Dockerfile`** that:
- builds the React app
- serves it from FastAPI (same domain)

Steps:
- Create a Railway service from this GitHub repo (root)
- Railway should auto-detect Docker and build the root `Dockerfile`
- Set backend variables (same as API service), plus:
  - `PUBLIC_APP_URL=https://<your-railway-domain>`
  - `CORS_ORIGINS=https://<your-railway-domain>`

In this mode, the frontend calls the API via same-origin `/api`.

## Webhook URLs

Configure your DNS so `app.protrades.in` points to your host. Default branded paths:

- `POST /webhook/amibroker` — header `X-ProTrades-Key`
- `POST /webhook/tradingview` — header or `?key=` query
- `POST /webhook/chartink` — header or `?key=`
- `POST /webhook/python` — header

Copy your **ProTrades API key** from **Settings** after first launch.

## AmiBroker: OpenAlgo data plugin (optional)

The **OpenAlgo AmiBroker Data Plugin** (v1.0.0) lives in **`OpenAlgoPlugin-master/`**. It gives AmiBroker **real-time and historical** Indian market data by connecting to an **[OpenAlgo](https://openalgo.in)** server — **not** to the ProTrades API.

| Need | Where |
|------|--------|
| Market data inside AmiBroker | Build/install the plugin from `OpenAlgoPlugin-master/` (see its README) and run **`openalgo-main/`** (or any OpenAlgo deployment) as the data backend. |
| Orders / signals into ProTrades | Use **Strategy → Send signal** or `POST /webhook/amibroker` with your ProTrades API key (Rupeezzy execution + risk engine). |

ProTrades and OpenAlgo are complementary here: OpenAlgo (+ this plugin) for **data**, ProTrades for **execution and automation** you configure in the web app.

## Stitch design assets

Screenshots and sample HTML from the Quant Edge Stitch project are under `frontend/public/stitch/` (downloaded via Stitch MCP).

## Environment

| Variable | Purpose |
|----------|---------|
| `PROTRADES_SECRET` | JWT + Fernet encryption for stored secrets |
| `DATABASE_URL` | SQLite (dev) or PostgreSQL (prod) |
| `RUPEEZZY_BASE` | Broker REST base URL |
| `RUPEEZZY_MOCK` | `1` uses mock broker responses |
| `CLAUDE_KEY` | Anthropic API key for ProBot |
| `PUBLIC_APP_URL` | Used in webhook URL helper (`app.protrades.in`) |

## License

Proprietary — built for Indian markets.
