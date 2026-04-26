#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Укажите свой email для Let's Encrypt (уведомления об истечении)
: "${CERTBOT_EMAIL:?Задайте переменную CERTBOT_EMAIL, например: export CERTBOT_EMAIL=you@mail.com}"

DOMAIN="${CERTBOT_DOMAIN:-playbetatool.ru}"

mkdir -p certbot/conf certbot/www
chmod -R a+rX certbot/www 2>/dev/null || true

echo "Запуск стека (HTTP, порт 80)…"
docker compose up -d

# Подхватить актуальный conf.d (после git pull) и проверить конфиг.
docker compose exec -T nginx nginx -t
docker compose exec -T nginx nginx -s reload 2>/dev/null || true

echo "Запрос сертификата для $DOMAIN и www.$DOMAIN …"
docker run --rm \
  -v "$ROOT/certbot/conf:/etc/letsencrypt" \
  -v "$ROOT/certbot/www:/var/www/certbot" \
  certbot/certbot:latest certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$CERTBOT_EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN" \
  -d "www.$DOMAIN"

echo "Включение редиректа и HTTPS в nginx…"
bash "$ROOT/scripts/enable-https.sh"
