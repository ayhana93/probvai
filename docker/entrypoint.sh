#!/bin/sh
# Стартиране на контейнера.
#
# При RUN_MIGRATIONS=1 първо вдига схемата на базата, после пуска приложението.
# Миграциите искат DATABASE_URL (ролята-собственик), а самото приложение —
# DATABASE_URL_APP и DATABASE_URL_SYSTEM.
set -e

if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  if [ -z "${DATABASE_URL:-}" ]; then
    echo "RUN_MIGRATIONS=1, но DATABASE_URL липсва. Спирам." >&2
    exit 1
  fi
  echo "→ Прилагам миграциите..."
  node node_modules/prisma/build/index.js migrate deploy \
    --schema packages/db/prisma/schema.prisma
  echo "→ Готово."
fi

exec "$@"
