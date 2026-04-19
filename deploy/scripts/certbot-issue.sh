#!/usr/bin/env bash
# Issue an initial Let's Encrypt cert for $DOMAIN.
#
# Prereqs:
#   * DNS A-record points $DOMAIN to this VPS.
#   * nginx is running with deploy/nginx/conf.d/bootstrap.conf (HTTP-only).
#
# Usage:
#   DOMAIN=example.com EMAIL=admin@example.com ./certbot-issue.sh
set -euo pipefail

: "${DOMAIN:?set DOMAIN=yourdomain.tld}"
: "${EMAIL:?set EMAIL=you@yourdomain.tld}"

cd "$(dirname "$0")/.."

echo "[certbot] issuing cert for ${DOMAIN} and www.${DOMAIN}…"
docker compose run --rm --entrypoint "" certbot \
  certbot certonly --webroot -w /var/www/certbot \
    --non-interactive --agree-tos --no-eff-email \
    -m "${EMAIL}" \
    -d "${DOMAIN}" -d "www.${DOMAIN}"

echo "[certbot] reloading nginx…"
docker compose exec nginx nginx -s reload
echo "[certbot] done."
