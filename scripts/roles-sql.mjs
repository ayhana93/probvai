/**
 * Сглобява SQL-а, който дава пароли и право на вход на трите работни роли.
 *
 * ═══ ЗАЩО Е ОТДЕЛЕН ФАЙЛ, А НЕ ЧАСТ ОТ db-roles.ts ═══
 *
 * Едно и също нещо трябва да се случва на две много различни места:
 *
 *   • локално       `npm run db:roles`, през tsx и пакета `pg`;
 *   • в контейнера  entrypoint-ът, където няма нито tsx, нито `pg` —
 *                   там SQL-ът се подава на `prisma db execute`.
 *
 * Две реализации на едно правило се разминават — обикновено месеци по-късно
 * и винаги в производствената. Затова текстът на заявките се прави ТУК, а
 * двата пътя само го изпълняват.
 *
 * Файлът е обикновен .mjs без зависимости, за да го изпълни голият node
 * в производствения образ.
 *
 * Пускане самостоятелно:  node scripts/roles-sql.mjs
 * Извежда SQL на стандартния изход и нищо друго.
 */

import { pathToFileURL } from 'node:url';

/** Коя роля от коя връзка си вади потребителя и паролата. */
export const ROLES = [
  { role: 'app_user', env: 'DATABASE_URL_APP' },
  { role: 'app_system', env: 'DATABASE_URL_SYSTEM' },
  { role: 'app_admin', env: 'DATABASE_URL_ADMIN' },
];

/**
 * Цитира текст като литерал в Postgres.
 *
 * Единичните кавички се удвояват. Ако има обратна наклонена черта, минаваме
 * на формата E'...', защото само в нея тя значи екраниране — иначе парола с
 * `\` би влязла променена и входът после не работи.
 */
function quoteLiteral(value) {
  const escaped = value.replace(/'/g, "''");
  if (!value.includes('\\')) return `'${escaped}'`;
  return `E'${escaped.replace(/\\/g, '\\\\')}'`;
}

/** Цитира име на роля. Имената са от списъка по-горе, но правилото важи винаги. */
function quoteIdentifier(name) {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Връща заявките за трите роли.
 * Хвърля с ясно съобщение при липсваща, сгрешена или безпаролна връзка —
 * роля без парола не бива да получава право на вход.
 */
export function rolesSql(env = process.env) {
  const statements = [];

  for (const { role, env: name } of ROLES) {
    const raw = env[name];
    if (!raw) {
      throw new Error(`Липсва ${name}.`);
    }

    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      throw new Error(`${name} не е валиден адрес за връзка.`);
    }

    const user = decodeURIComponent(parsed.username);
    const password = decodeURIComponent(parsed.password);

    if (user !== role) {
      throw new Error(
        `${name} се свързва като "${user}", а очакваме "${role}". ` +
          `Поправи връзката — иначе Row Level Security не важи за нея.`,
      );
    }
    if (!password) {
      throw new Error(
        `${name} няма парола. Роля без парола не бива да има право на вход.`,
      );
    }

    statements.push(
      `ALTER ROLE ${quoteIdentifier(role)} WITH LOGIN PASSWORD ${quoteLiteral(password)};`,
    );
  }

  return statements;
}

// Пуснат директно: изсипва SQL-а, за да бъде подаден по тръба.
// Внесен като модул: не прави нищо.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.stdout.write(rolesSql().join('\n') + '\n');
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
