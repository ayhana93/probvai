#!/bin/sh
# Стартиране на контейнера.
#
# При RUN_MIGRATIONS=1 първо вдига схемата на базата, после пуска приложението.
# Миграциите искат DATABASE_URL (ролята-собственик), а самото приложение —
# DATABASE_URL_APP и DATABASE_URL_SYSTEM.
#
# ═══ ЗАЩО СЕ ПРАВЯТ И РОЛИТЕ, А НЕ САМО МИГРАЦИИТЕ ═══
#
# Миграцията създава `app_user`, `app_system` и `app_admin` БЕЗ парола и без
# право на вход — нарочно, за да няма тайни в git. Тоест след чиста миграция
# приложението не може да се свърже с базата с нито една от своите роли.
#
# Тази стъпка им дава паролите от самите връзки в средата. Без нея първото
# пускане на нов хост завършва с „password authentication failed" — грешка,
# която изглежда като сбъркана настройка, а всъщност е липсваща стъпка.
set -e

if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  if [ -z "${DATABASE_URL:-}" ]; then
    echo "RUN_MIGRATIONS=1, но DATABASE_URL липсва. Спирам." >&2
    exit 1
  fi

  echo "→ Прилагам миграциите..."
  node node_modules/prisma/build/index.js migrate deploy \
    --schema packages/db/prisma/schema.prisma

  echo "→ Задавам паролите на работните роли..."
  # SQL-ът се сглобява от същия файл, който ползва и `npm run db:roles`.
  # `prisma db execute` е тук, защото в този образ няма нито tsx, нито `pg`.
  node scripts/roles-sql.mjs | node node_modules/prisma/build/index.js db execute \
    --url "$DATABASE_URL" --stdin

  echo "→ Готово."
fi

exec "$@"
