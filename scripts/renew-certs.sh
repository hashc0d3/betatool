#!/usr/bin/env bash
# Добавьте в cron на сервере, например раз в день:
# 0 3 * * * cd /opt/betatool && ./scripts/renew-certs.sh >>/var/log/certbot-renew.log 2>&1
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

docker run --rm \
  -v "$ROOT/certbot/conf:/etc/letsencrypt" \
  -v "$ROOT/certbot/www:/var/www/certbot" \
  certbot/certbot:latest renew --webroot -w /var/www/certbot
docker compose exec nginx nginx -s reload
echo "$(date -Iseconds) renew attempt done"
