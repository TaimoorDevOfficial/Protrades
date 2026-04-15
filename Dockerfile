# ---------- Frontend build ----------
FROM node:20-alpine AS web-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ---------- Backend runtime ----------
FROM python:3.12-slim AS api

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends gcc \
  && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ ./backend/

# Copy built SPA into backend for single-service hosting
COPY --from=web-build /app/frontend/dist ./backend/frontend_dist

# Include start script so Railway "bash start.sh" works
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

ENV PYTHONUNBUFFERED=1

EXPOSE 8000

# Railway may override CMD; keep it aligned with start.sh
CMD ["bash", "./start.sh"]

