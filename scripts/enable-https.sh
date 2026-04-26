#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CERT_PATH="certbot/conf/live/playbetatool.ru/fullchain.pem"
if [[ ! -f "$CERT_PATH" ]]; then
  echo "Файл сертификата не найден: $CERT_PATH"
  echo "Сначала выполните: ./scripts/init-letsencrypt.sh"
  exit 1
fi

cp docker/nginx/templates/00-http-redirect.conf docker/nginx/conf.d/00-http.conf
cp docker/nginx/templates/01-https.conf docker/nginx/conf.d/01-https.conf

docker compose exec nginx nginx -t
docker compose exec nginx nginx -s reload
echo "HTTPS включён. Проверьте: https://playbetatool.ru"
