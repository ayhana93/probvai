/**
 * Прави копията на снимките за показване.
 *
 * ═══ ЗАЩО ОРИГИНАЛЪТ НЕ СЕ СЕРВИРА ═══
 *
 * Файлът на клиента е 1536 × 1024 и 2.6 MB. На екрана логото е широко 188
 * пиксела на началния екран и 280 на входа. Тоест сервираме 2.6 MB, за да
 * покажем нещо колкото визитка — и то на ПЪРВИЯ екран, преди човек да е
 * видял каквото и да било друго.
 *
 * По българска мобилна мрежа това са няколко секунди на празно място.
 * Първото впечатление от приложението е точно това чакане.
 *
 * Затова: оригиналът остава в хранилището непокътнат — той е източникът.
 * Сервира се умалено копие, широко 840 пиксела. Толкова стигат за 280
 * пиксела на екран с тройна плътност; повече пиксели просто няма къде да се
 * покажат.
 *
 * Картинката е СЪЩАТА. Махнати са само пиксели, които никой монитор не
 * показва.
 *
 * Същото важи и за трите снимки на стартовия екран: четири файла по два
 * мегабайта са седем мегабайта на ПЪРВИЯ екран, който вижда човек.
 *
 * Пускане:  npm run images
 * След смяна на който и да е изходен файл се пуска пак.
 */

import { existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const brand = resolve(root, 'apps/web/public/brand');

const SOURCE = resolve(brand, 'logo.png');

/**
 * Най-широкото място, на което стои логото, е входът: 280 пиксела.
 * По три пиксела на точка прави 840.
 */
const WIDTH = 840;

async function sizeOf(path) {
  return ((await stat(path)).size / 1024).toFixed(0);
}

async function main() {
  if (!existsSync(SOURCE)) {
    console.error(`\n  ✗ Липсва ${SOURCE}\n`);
    process.exit(1);
  }

  const meta = await sharp(SOURCE).metadata();
  console.log(`\n  Оригинал: ${meta.width} × ${meta.height}, ${await sizeOf(SOURCE)} KB\n`);

  // Прозрачността се пази. Логото стои върху хартиения фон на приложението,
  // а не върху бяло — плътен бял правоъгълник би личал веднага.
  //
  // ═══ ЗАЩО PNG С ПАЛИТРА, А НЕ WebP ═══
  //
  // Пробвах и двете: WebP на качество 90 излиза 103 KB, PNG с палитра —
  // 93 KB. По-малкото е и по-простото: PNG го разбира всеки браузър, значи
  // не трябват нито `<picture>`, нито резервен вариант, нито ред, в който
  // да се сбъркат.
  //
  // Палитрата свива до 256 цвята и това обикновено се вижда по гладките
  // преливания. Тук — не: сверих изрязано парче с фолиото и кожухчето,
  // най-тежките места, и разликата не се хваща. А и на екрана картинката
  // се смалява още веднъж.
  const png = resolve(brand, 'logo-840.png');
  await sharp(SOURCE)
    .resize({ width: WIDTH, withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true })
    .toFile(png);

  console.log(`  ✓ logo-840.png    ${await sizeOf(png)} KB`);

  console.log(
    `\n  Съотношение за logo.tsx: ${meta.width} / ${meta.height}` +
      ` = ${(meta.width / meta.height).toFixed(4)}`,
  );

  /**
   * ═══ ВТОРИ ФАЙЛ: ЛОГОТО БЕЗ ПОЛЕТАТА ═══
   *
   * Оригиналът е 3:2 и около самия надпис има широка прозрачна ивица.
   * За начален екран това е добре — логото диша.
   *
   * Върху КОПЧЕ обаче полетата стават празнина вътре в копчето: подложката
   * пораства с тях и се получава голям лаймов правоъгълник с малък надпис в
   * средата. Точно това изглеждаше зле.
   *
   * `trim` реже прозрачното до самия надпис. Отстоянието после се дава от
   * `padding`-а на копчето — тоест го решава дизайнът, а не файлът.
   */
  const tight = resolve(brand, 'logo-tight.png');
  const trimmed = sharp(SOURCE).trim({ threshold: 1 });
  const tightMeta = await trimmed
    .resize({ width: WIDTH, withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true })
    .toFile(tight);

  console.log(`  ✓ logo-tight.png  ${await sizeOf(tight)} KB`);
  console.log(
    `  Съотношение за logo.tsx (tight): ${tightMeta.width} / ${tightMeta.height}` +
      ` = ${(tightMeta.width / tightMeta.height).toFixed(4)}\n`,
  );

  await flow();
}

/**
 * Снимките на стартовия екран.
 *
 * ═══ ЗАЩО НЕ СЕ РЕЖАТ ═══
 *
 * Трите изходни файла са с много различни съотношения: човекът е висок
 * 2:3, аутфитът е ШИРОК 5:4, скрийншотът е много висок 0.46. Едно общо
 * съотношение би отрязало или главата на човека, или половината аутфит.
 *
 * Затова тук само се СМАЛЯВАТ, без рязане. Вписването в рамката е работа
 * на `object-contain` в интерфейса — там се вижда цялата снимка, а
 * празното отстрани е бяло, точно както при подредба на дрехи върху лист.
 */
async function flow() {
  const dir = resolve(root, 'apps/web/public/flow');
  const names = ['1-snimka', '2-drexa', '2-skrinshot', '3-rezultat'];

  console.log('  Стартовият екран:\n');

  for (const name of names) {
    const source = resolve(dir, `${name}.jpg`);
    if (!existsSync(source)) {
      console.log(`  · ${name}.jpg — липсва, пропускам`);
      continue;
    }

    const out = resolve(dir, `${name}-720.jpg`);
    await sharp(source)
      // Само по широчина. Височината се смята сама и съотношението остава.
      .resize({ width: 720, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(out);

    console.log(`  ✓ ${name}-720.jpg`.padEnd(28) + `${await sizeOf(out)} KB`);
  }

  console.log('');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
