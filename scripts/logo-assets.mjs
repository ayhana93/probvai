/**
 * Прави копията на логото за показване.
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
 * Пускане:  npm run logo
 * След смяна на `logo.png` се пуска пак.
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
      ` = ${(meta.width / meta.height).toFixed(4)}\n`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
