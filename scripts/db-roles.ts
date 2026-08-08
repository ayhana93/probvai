/**
 * Задава пароли и право на вход на трите работни DB роли.
 *
 * Миграцията създава ролите без парола (тайни в git няма). Този скрипт вади
 * потребителя и паролата от съответната връзка в `.env` и ги прилага.
 * Така има един източник на истината — самата връзка.
 *
 * Текстът на заявките се сглобява в `scripts/roles-sql.mjs`, защото същият
 * SQL трябва и в производствения контейнер, където няма нито tsx, нито `pg`.
 * Две реализации на едно правило се разминават — обикновено месеци по-късно.
 *
 * Пускане:  npm run db:roles
 * Изисква:  DATABASE_URL сочи към роля с право CREATEROLE (собственика).
 */

import { existsSync } from 'node:fs';
import { Client } from 'pg';
import { rolesSql, ROLES } from './roles-sql.mjs';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

function fail(message: string): never {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  const adminUrl = process.env.DATABASE_URL;
  if (!adminUrl) {
    fail('Липсва DATABASE_URL. Тя сочи към собственика на базата.');
  }

  let statements: string[];
  try {
    statements = rolesSql();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  const client = new Client({ connectionString: adminUrl });
  await client.connect();

  try {
    for (const [index, statement] of statements.entries()) {
      await client.query(statement);
      const role = ROLES[index]?.role ?? '?';
      console.log(`  ✓ ${role.padEnd(12)} паролата е зададена, входът е разрешен`);
    }

    console.log('\n  Готово. Трите роли могат да се свързват.\n');
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
