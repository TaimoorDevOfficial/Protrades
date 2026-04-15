#!/usr/bin/env bash
# Railway start script (single service).
# Serves FastAPI + built SPA from the same domain.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/backend" || { echo "Missing backend at $ROOT/backend"; ls -la "$ROOT"; exit 1; }

PORT="${PORT:-8000}"

# Prefer gunicorn+uvicorn worker in production if gunicorn is available.
if command -v gunicorn >/dev/null 2>&1; then
  exec gunicorn -k uvicorn.workers.UvicornWorker -w "${WEB_CONCURRENCY:-2}" -b "0.0.0.0:${PORT}" main:app
fi

exec uvicorn main:app --host 0.0.0.0 --port "${PORT}"

