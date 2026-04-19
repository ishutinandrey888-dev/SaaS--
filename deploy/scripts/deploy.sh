#!/usr/bin/env bash
# Pull latest code, rebuild images, apply migrations, zero-downtime reload.
set -euo pipefail

cd "$(dirname "$0")/.."
REPO_ROOT="$(cd .. && pwd)"

BRANCH="${BRANCH:-main}"

echo "[deploy] fetching ${BRANCH}…"
git -C "${REPO_ROOT}" fetch origin "${BRANCH}"
git -C "${REPO_ROOT}" reset --hard "origin/${BRANCH}"

echo "[deploy] building images…"
docker compose build backend

echo "[deploy] running migrations…"
docker compose run --rm backend alembic upgrade head

echo "[deploy] rolling backend/worker/beat…"
docker compose up -d --no-deps --build backend worker beat

echo "[deploy] nginx reload…"
docker compose exec nginx nginx -t
docker compose exec nginx nginx -s reload

echo "[deploy] done."
docker compose ps
