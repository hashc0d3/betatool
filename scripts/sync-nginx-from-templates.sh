#!/usr/bin/env bash
# После git pull: обновить nginx conf.d из templates (актуально для HTTPS).
# Файл conf.d/01-https.conf не хранится в репозитории как «живой» артефакт на сервере —
# его копируют из templates при ./scripts/enable-https.sh, поэтому правки в
# docker/nginx/templates/*.conf нужно заново применить этим скриптом.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CERT_PATH="certbot/conf/live/playbetatool.ru/fullchain.pem"
if [[ ! -f "$CERT_PATH" ]]; then
  echo "Сертификат не найден: $CERT_PATH"
  echo "Для этапа только HTTP достаточно: git checkout docker/nginx/conf.d/00-http.conf && git pull"
  exit 1
fi

echo "Копирую docker/nginx/templates/*.conf → conf.d (HTTPS уже включён)…"
cp docker/nginx/templates/00-http-redirect.conf docker/nginx/conf.d/00-http.conf
cp docker/nginx/templates/01-https.conf docker/nginx/conf.d/01-https.conf

docker compose exec -T nginx nginx -t
docker compose exec -T nginx nginx -s reload
echo "Готово. Проверьте вход на сайте (POST /api/auth/login)."
