#!/usr/bin/env bash
# Railway build script (monorepo, single service).
# Builds frontend and installs backend deps.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

PYTHON="${PYTHON:-python3}"
if ! command -v "$PYTHON" >/dev/null 2>&1; then
  PYTHON=python
fi
echo "==> $($PYTHON --version 2>&1)"

echo ""
echo "==> Installing Python dependencies..."
cd "$ROOT/backend"
"$PYTHON" -m pip install --upgrade pip
"$PYTHON" -m pip install -r requirements.txt
cd "$ROOT"

echo ""
echo "==> Building frontend..."
cd "$ROOT/frontend"
if command -v npm >/dev/null 2>&1; then
  npm ci
  npm run build
else
  echo "ERROR: npm not found. Use Docker deploy or a Node-enabled builder."
  exit 1
fi
cd "$ROOT"

echo ""
echo "==> Copying frontend build into backend/frontend_dist/ ..."
rm -rf "$ROOT/backend/frontend_dist"
mkdir -p "$ROOT/backend/frontend_dist"
cp -R "$ROOT/frontend/dist/." "$ROOT/backend/frontend_dist/"

echo ""
echo "==> Build complete."

