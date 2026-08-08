# syntax=docker/dockerfile:1
#
# ПРОБВАЙ — производственият образ на УЕБ приложението.
#
# Правило №1 от заданието: нищо специфично за Railway. Този образ тръгва на
# всеки Docker хост — нужни са само променливите на средата и достъп до
# Postgres. Никакви монтирани дискове, никакви платформени API-та.
#
# ═══ ЗАЩО РАБОТНИКЪТ Е В ОТДЕЛЕН ФАЙЛ ═══
#
# Беше етап в този Dockerfile, след `runner`. Повечето платформи — Railway
# между тях — строят ПОСЛЕДНИЯ етап на многоетапен файл. Тоест успешен билд
# щеше да пусне работника вместо уеб приложението, и то тихо: контейнерът
# тръгва, здравната проверка мълчи, а сайтът просто не отговаря.
#
# Затова: този файл прави уеб приложението и `runner` е последен. Работникът
# е в `Dockerfile.worker`.

# ─────────────────────────────────────────────────────────────────────────────
# База — Debian, а не Alpine.
# Prisma и sharp носят нативни части, компилирани срещу glibc. С Alpine
# трябват допълнителни пакети и понякога различен engine — не си струва.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app


# ─────────────────────────────────────────────────────────────────────────────
# Зависимости — отделен слой, за да се преизползва кешът, докато
# package-lock.json не се промени.
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS deps

COPY package.json package-lock.json ./
COPY packages/db/package.json ./packages/db/
COPY packages/core/package.json ./packages/core/
COPY apps/web/package.json ./apps/web/

RUN npm ci


# ─────────────────────────────────────────────────────────────────────────────
# Билд
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS builder

COPY --from=deps /app ./
COPY . .

# Генерира Prisma клиента за платформата на образа.
RUN npx prisma generate --schema packages/db/prisma/schema.prisma

# `next build` с output: 'standalone' — резултатът носи само това, което
# наистина се ползва по време на работа.
RUN npm run build --workspace @probvai/web


# ─────────────────────────────────────────────────────────────────────────────
# Изпълнение
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS runner

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Самостоятелният изход вече съдържа нужните node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

# Prisma CLI и миграциите — за да може контейнерът сам да си вдигне схемата
# при RUN_MIGRATIONS=1. Така пускането на нов хост е една команда.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/prisma ./packages/db/prisma

# Сглобява SQL-а за паролите на работните роли. Обикновен .mjs без
# зависимости точно за да го изпълни голият node в този образ.
COPY --from=builder --chown=nextjs:nodejs /app/scripts/roles-sql.mjs ./scripts/roles-sql.mjs

COPY --chown=nextjs:nodejs docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "apps/web/server.js"]
