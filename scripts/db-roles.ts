/**
 * Задава пароли и право на вход на трите работни DB роли.
 *
 * Миграцията създава ролите без парола (тайни в git няма). Този скрипт вади
 * потребителя и паролата от съответната връзка в `.env` и ги прилага.
 * Така има един източник на истината — самата връзка.
 *
 * Пускане:  npm run db:roles
 * Изисква:  DATABASE_URL сочи към роля с право CREATEROLE (собственика).
 */

import { existsSync } from 'node:fs';
import { Client } from 'pg';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

type RoleSpec = {
  /** Как се казва ролята в миграцията. */
  role: string;
  /** От коя променлива да вземем потребителя и паролата. */
  env: string;
};

const ROLES: RoleSpec[] = [
  { role: 'app_user', env: 'DATABASE_URL_APP' },
  { role: 'app_system', env: 'DATABASE_URL_SYSTEM' },
  { role: 'app_admin', env: 'DATABASE_URL_ADMIN' },
];

function fail(message: string): never {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  const adminUrl = process.env.DATABASE_URL;
  if (!adminUrl) {
    fail('Липсва DATABASE_URL. Тя сочи към собственика на базата.');
  }

  const client = new Client({ connectionString: adminUrl });
  await client.connect();

  try {
    for (const { role, env } of ROLES) {
      const raw = process.env[env];
      if (!raw) {
        fail(`Липсва ${env}.`);
      }

      let parsed: URL;
      try {
        parsed = new URL(raw);
      } catch {
        fail(`${env} не е валиден адрес за връзка.`);
      }

      const user = decodeURIComponent(parsed.username);
      const password = decodeURIComponent(parsed.password);

      if (user !== role) {
        fail(
          `${env} се свързва като "${user}", а очакваме "${role}". ` +
            `Поправи връзката — иначе RLS не важи за нея.`,
        );
      }
      if (!password) {
        fail(`${env} няма парола. Роля без парола не бива да има право на вход.`);
      }

      // Изграждаме SQL-а през format() на самия Postgres — %I и %L цитират
      // името и стойността правилно, така че парола със специални знаци
      // не може да излезе от литерала.
      const built = await client.query<{ sql: string }>(
        `SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', $1::text, $2::text) AS sql`,
        [role, password],
      );

      const statement = built.rows[0]?.sql;
      if (!statement) {
        fail(`Не успях да сглобя заявката за ролята ${role}.`);
      }

      await client.query(statement);
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
