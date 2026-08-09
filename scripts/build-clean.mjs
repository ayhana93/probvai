/**
 * Билд с ПРАЗНА среда.
 *
 * ═══ ЗАЩО СЪЩЕСТВУВА ═══
 *
 * Два пъти пускането на нов хост падна по една и съща причина: файл, който
 * чете от средата на ниво МОДУЛ, а не при заявка. Веднъж беше
 * `const system = dbSystem()` в auth.ts, втория път шаблонен низ със
 * `env.UPLOAD_MAX_BYTES` в /api/upload.
 *
 * И двата пъти билдът минаваше на машината, на която е писан кодът — там
 * `.env` го има. Падаше в чуждата среда, където го няма.
 *
 * Затова тази проверка пуска `next build` с изчистена среда: остават само
 * PATH, HOME и няколко служебни. Всяко четене от средата на ниво модул
 * гърми ТУК, преди да е стигнало до хостинга.
 *
 * Правилото зад нея: билдът произвежда образ, който тръгва на ВСЯКА среда.
 * Знае ли билдът стойност, специфична за една среда, образът вече не е общ.
 *
 * Пускане:  npm run build:clean
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Каквото трябва, за да тръгне node — и нищо повече.
 * Нарочно НЕ пускаме нищо от .env: това е целта на проверката.
 */
const KEEP = ['PATH', 'HOME', 'LANG', 'LC_ALL', 'TMPDIR', 'SHELL', 'TERM'];

const clean = Object.fromEntries(
  KEEP.filter((name) => process.env[name] !== undefined).map((name) => [
    name,
    process.env[name],
  ]),
);

clean.NODE_ENV = 'production';
clean.NEXT_TELEMETRY_DISABLED = '1';

console.log('→ Билд с празна среда. Всяко четене от process.env на ниво модул ще гръмне.\n');

const result = spawnSync(
  resolve(root, 'node_modules/.bin/next'),
  ['build'],
  {
    cwd: resolve(root, 'apps/web'),
    env: clean,
    stdio: 'inherit',
  },
);

if (result.status !== 0) {
  console.error(
    '\n  ✗ Билдът иска нещо от средата.\n' +
      '    Виж грешката отгоре и премести четенето вътре във функция —\n' +
      '    на ниво модул не се чете нищо от process.env.\n',
  );
  process.exit(result.status ?? 1);
}

console.log('\n  ✓ Билдът не иска нищо от средата. Образът тръгва навсякъде.\n');
