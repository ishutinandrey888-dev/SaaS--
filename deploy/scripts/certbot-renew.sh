#!/usr/bin/env bash
# Renew Let's Encrypt cert if needed (safe to run daily via systemd timer).
set -euo pipefail

cd "$(dirname "$0")/.."

docker compose run --rm --entrypoint "" certbot \
  certbot renew --quiet --webroot -w /var/www/certbot

docker compose exec nginx nginx -s reload
