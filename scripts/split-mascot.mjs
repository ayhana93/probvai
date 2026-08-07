/**
 * Реже листа с героя на осем отделни изображения с прозрачен фон.
 *
 *   node scripts/split-mascot.mjs <път-до-листа.png>
 *
 * Листът е 4 колони × 2 реда, с надпис под всяка фигура. Скриптът:
 *   1. реже на осем клетки
 *   2. маха долната лента с надписа
 *   3. маха белия фон — но САМО свързания с ръба
 *   4. подрязва празното наоколо и записва в apps/web/public/mascot/
 *
 * ═══ ЗАЩО ФОНЪТ СЕ МАХА С ЗАЛИВАНЕ ОТ РЪБА, А НЕ ГЛОБАЛНО ═══
 *
 * Ако просто направим всеки бял пиксел прозрачен, изчезват и белите
 * парчета ВЪТРЕ в топката, и каретата на шапката. Заливането тръгва от
 * ръба и спира на тъмния контур — вътрешното бяло остава.
 */

import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const COLS = 4;
const ROWS = 2;

/** Колко от долната част на клетката е надпис, не фигура. */
const LABEL_SHARE = 0.17;

/** Колко близо до бялото е „фон". 0–255, по-високо = по-агресивно. */
const WHITE_TOLERANCE = 26;

/** Реда на състоянията в листа, отляво надясно, отгоре надолу. */
const NAMES = [
  'empty', // 0 кредита
  'low', // 1–4
  'happy', // 5 и повече
  'full', // пълна
  'stale', // не си идвала
  'working', // работи
  'done', // готово
  'failed', // не се получи
];

const source = process.argv[2];
if (!source) {
  console.error('\n  Ползване: node scripts/split-mascot.mjs <лист.png>\n');
  process.exit(1);
}

const outDir = path.join(process.cwd(), 'apps/web/public/mascot');
mkdirSync(outDir, { recursive: true });

/**
 * Прави фона прозрачен чрез заливане от ръба.
 * Ползва обхождане в ширина — рекурсия на 1000×1000 пиксела свършва стека.
 */
function clearBackground(data, width, height, channels) {
  const isWhite = (index) =>
    data[index] > 255 - WHITE_TOLERANCE &&
    data[index + 1] > 255 - WHITE_TOLERANCE &&
    data[index + 2] > 255 - WHITE_TOLERANCE;

  const seen = new Uint8Array(width * height);
  const queue = [];

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pixel = y * width + x;
    if (seen[pixel]) return;
    if (!isWhite(pixel * channels)) return;
    seen[pixel] = 1;
    queue.push(pixel);
  };

  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }

  while (queue.length > 0) {
    const pixel = queue.pop();
    const x = pixel % width;
    const y = (pixel - x) / width;

    data[pixel * channels + 3] = 0;

    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  return data;
}

async function main() {
  const image = sharp(source);
  const meta = await image.metadata();
  const sheetWidth = meta.width ?? 0;
  const sheetHeight = meta.height ?? 0;

  if (!sheetWidth || !sheetHeight) {
    throw new Error('Не мога да прочета размерите на листа.');
  }

  const cellWidth = Math.floor(sheetWidth / COLS);
  const cellHeight = Math.floor(sheetHeight / ROWS);
  const figureHeight = Math.floor(cellHeight * (1 - LABEL_SHARE));

  console.log(`\n  Лист ${sheetWidth}×${sheetHeight} → клетка ${cellWidth}×${cellHeight}\n`);

  for (let index = 0; index < NAMES.length; index += 1) {
    const name = NAMES[index];
    const col = index % COLS;
    const row = Math.floor(index / COLS);

    const cell = await sharp(source)
      .extract({
        left: col * cellWidth,
        top: row * cellHeight,
        width: cellWidth,
        height: figureHeight,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const cleared = clearBackground(
      cell.data,
      cell.info.width,
      cell.info.height,
      cell.info.channels,
    );

    const target = path.join(outDir, `${name}.png`);

    await sharp(cleared, {
      raw: {
        width: cell.info.width,
        height: cell.info.height,
        channels: cell.info.channels,
      },
    })
      .trim({ threshold: 1 })
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(target);

    console.log(`  ✓ ${name.padEnd(8)} → apps/web/public/mascot/${name}.png`);
  }

  console.log('\n  Готово. Провери ги и пусни: npm run dev\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
