# ---------- Frontend build ----------
FROM node:20-alpine AS web-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ---------- Backend runtime ----------
FROM python:3.12-slim AS api

WORKDIR /app/backend

RUN apt-get update \
  && apt-get install -y --no-install-recommends gcc \
  && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

# Copy built SPA into backend for single-service hosting
COPY --from=web-build /app/frontend/dist ./frontend_dist

ENV PYTHONUNBUFFERED=1

EXPOSE 8000

# Railway sets PORT; fall back to 8000 locally
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]

