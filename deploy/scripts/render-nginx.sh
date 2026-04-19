#!/usr/bin/env bash
# Render nginx conf templates with the real domain.
#
# Usage:
#   DOMAIN=example.com MODE=bootstrap ./render-nginx.sh   # HTTP-only
#   DOMAIN=example.com MODE=app ./render-nginx.sh         # full TLS
set -euo pipefail

: "${DOMAIN:?set DOMAIN=yourdomain.tld}"
: "${MODE:=app}"

cd "$(dirname "$0")/.."
CONF_DIR="nginx/conf.d"

case "${MODE}" in
  bootstrap)
    SRC="${CONF_DIR}/bootstrap.conf.template"
    DST="${CONF_DIR}/bootstrap.conf"
    rm -f "${CONF_DIR}/app.conf"
    ;;
  app)
    SRC="${CONF_DIR}/app.conf.template"
    DST="${CONF_DIR}/app.conf"
    rm -f "${CONF_DIR}/bootstrap.conf"
    ;;
  *)
    echo "MODE must be bootstrap or app" >&2
    exit 2
    ;;
esac

sed "s/{{DOMAIN}}/${DOMAIN}/g" "${SRC}" > "${DST}"
echo "[render] wrote ${DST} for ${DOMAIN}"
