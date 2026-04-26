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

# nginx должен быть running; иначе часто «address already in use» на :80 у другого процесса.
sleep 2
if ! docker compose exec -T nginx true 2>/dev/null; then
  echo "Контейнер nginx недоступен. См.: docker compose logs nginx --tail 60"
  echo "Если был error «address already in use» на :80 — освободите порт (ss -tlnp | grep ':80 ') и остановите host nginx/apache или второй compose."
  exit 1
fi

# Подхватить актуальный conf.d (после git pull) и проверить конфиг.
docker compose exec -T nginx nginx -t
docker compose exec -T nginx nginx -s reload 2>/dev/null || true

# Проверка: с хоста на :80 должен отвечать ИМЕННО этот nginx и отдавать webroot (иначе LE получит 404).
PREFLIGHT_TOKEN="_le-preflight-$RANDOM"
echo ok >"$ROOT/certbot/www/.well-known/acme-challenge/$PREFLIGHT_TOKEN"
cleanup_preflight() { rm -f "$ROOT/certbot/www/.well-known/acme-challenge/$PREFLIGHT_TOKEN" 2>/dev/null || true; }
trap cleanup_preflight EXIT
if ! curl -fsS --max-time 8 -H "Host: $DOMAIN" "http://127.0.0.1/.well-known/acme-challenge/$PREFLIGHT_TOKEN" | grep -qFx ok; then
  echo "С localhost:80 не отдаётся файл из certbot/www (Let’s Encrypt тоже получит 404)."
  echo "— Сделайте git pull актуального репо (при конфликте: git stash -u && git pull && git stash pop)."
  echo "— Порт 80 должен слушать только этот nginx: ss -tlnp | grep ':80 '"
  echo "— Конфиг: docker compose exec nginx cat /etc/nginx/conf.d/00-http.conf | head -35"
  exit 1
fi
trap - EXIT
cleanup_preflight

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
