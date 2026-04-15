#!/usr/bin/env bash
# Railway start script (single service).
# Serves FastAPI + built SPA from the same domain.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
# Repo layout: root/backend. Docker image layout: /app/backend already.
if [ -d "$ROOT/backend" ]; then
  cd "$ROOT/backend"
elif [ -f "$ROOT/main.py" ]; then
  cd "$ROOT"
else
  echo "Missing backend. Tried $ROOT/backend and $ROOT"
  ls -la "$ROOT"
  exit 1
fi

PORT="${PORT:-8000}"

# Prefer gunicorn+uvicorn worker in production if gunicorn is available.
if command -v gunicorn >/dev/null 2>&1; then
  exec gunicorn -k uvicorn.workers.UvicornWorker -w "${WEB_CONCURRENCY:-2}" -b "0.0.0.0:${PORT}" main:app
fi

exec uvicorn main:app --host 0.0.0.0 --port "${PORT}"

