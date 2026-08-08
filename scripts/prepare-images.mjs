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

import { existsSync, mkdirSync } from 'node:fs';
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
  await appIcon();
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

/**
 * ИКОНАТА НА ПРИЛОЖЕНИЕТО
 *
 * Прави всичко, което трябва, за да се появи иконата, когато някой сложи
 * ПРОБВАЙ на началния си екран — на iPhone и на Android.
 *
 * ═══ ЗАЩО ФАЙЛОВЕТЕ СА ПОВЕЧЕ ОТ ЕДИН ═══
 *
 * Двете системи искат различни неща и не си приличат:
 *
 *   apple-icon.png (180)  iOS. БЕЗ прозрачност — Safari слага ЧЕРНО зад
 *                         всяка алфа и логото излиза върху черен квадрат.
 *                         Ъглите също не се пипат: iOS ги заобля сам, а
 *                         предварително заоблена икона излиза с двоен ръб.
 *
 *   icon-192 / icon-512   Android, през манифеста.
 *
 *   icon-512-maskable     Android реже иконата в различна форма на всеки
 *                         телефон — кръг, капка, квадрат. „Maskable" значи,
 *                         че по края има 20% поле за рязане; без него
 *                         крайчетата на логото се губят.
 *
 *   icon.png (512)        Иконата в таба на браузъра.
 *
 * ═══ ЗАЩО ИЗТОЧНИКЪТ Е В `packages/core/assets` ═══
 *
 * Там е и водният знак — едно място за файловете, които не са код и се
 * качват през GitHub.
 */
const ICON_CANDIDATES = [
  'app-icon.png',
  'icon.png',
  'app-icon.jpg',
  'icon.jpg',
  'favicon.png',
];

/**
 * Фонът зад иконата се ВЗИМА ОТ САМАТА НЕЯ.
 *
 * Иконата е тъмна със заоблени ъгли върху черно. Закован светъл фон би
 * оставил бели ъгълчета там, където системата не реже. Затова се чете
 * ъгловият пиксел: каквато и икона да се качи утре, полето наоколо ще е
 * нейният собствен цвят.
 *
 * Прозрачен ъгъл значи икона без фон — тогава се пада на хартиеното.
 */
async function cornerColor(path) {
  const { data } = await sharp(path)
    .extract({ left: 0, top: 0, width: 8, height: 8 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const [r, g, b, a] = [data[0], data[1], data[2], data[3]];
  if (a < 250) return { r: 0xfa, g: 0xf6, b: 0xef, alpha: 1 };
  return { r, g, b, alpha: 1 };
}

/**
 * Каква част от платното заема иконата във варианта „maskable".
 *
 * Android реже с различна форма на всеки телефон и в най-лошия случай това
 * е КРЪГ с диаметър 80% от платното. Квадрат, вписан в такъв кръг, е широк
 * 80/√2 ≈ 57% — но нашата икона има собствени тъмни полета по ръба, които
 * може да се режат без загуба. 78% оставя буквите вътре в безопасния кръг,
 * без иконата да изглежда като марка върху плик.
 */
const MASKABLE_SCALE = 0.78;

async function appIcon() {
  const assets = resolve(root, 'packages/core/assets');
  const found = ICON_CANDIDATES.map((name) => resolve(assets, name)).find((path) =>
    existsSync(path),
  );

  console.log('  Иконата на приложението:\n');

  if (!found) {
    console.log(
      `  · липсва ${ICON_CANDIDATES[0]} в packages/core/assets — пропускам.\n` +
        '    Качи я там и пусни `npm run images` пак.\n',
    );
    return;
  }

  const background = await cornerColor(found);
  console.log(
    `  Източник: ${found.split('/').pop()}` +
      `  ·  фон rgb(${background.r}, ${background.g}, ${background.b})`,
  );

  const appDir = resolve(root, 'apps/web/app');
  const iconsDir = resolve(root, 'apps/web/public/icons');
  mkdirSync(iconsDir, { recursive: true });

  // Квадрат. Подадена правоъгълна, иконата се вписва ЦЯЛА и остатъкът е
  // нейният собствен фонов цвят — по-добре поле, отколкото отрязано лого.
  //
  // ═══ ЗАЩО PNG С ПАЛИТРА ═══
  //
  // Иконата е фотографска — плат, фолио, козина — и палитрата обикновено
  // личи точно на такива места. Сверих изрязано парче 1:1 с пълноцветното:
  // разликата не се хваща, а 512-те паднаха от 589 KB на 156 KB.
  const square = (size, bg) =>
    sharp(found)
      .resize({ width: size, height: size, fit: 'contain', background: bg })
      .png({ compressionLevel: 9, palette: true, quality: 92 });

  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

  // ── iOS ──────────────────────────────────────────────────────────────────
  // `flatten` маха алфата и слага фон. Без него Safari рисува ЧЕРНО зад
  // всяка прозрачност и иконата излиза върху черен квадрат.
  //
  // Ъглите нарочно не се пипат: iOS слага собствената си маска. Заоблена
  // предварително икона излиза с двоен ръб.
  const apple = resolve(appDir, 'apple-icon.png');
  await square(180, background).flatten({ background }).toFile(apple);
  console.log(`  ✓ app/apple-icon.png`.padEnd(32) + `${await sizeOf(apple)} KB`);

  // ── Табът на браузъра ────────────────────────────────────────────────────
  // 256 стигат: по-голямо от това никой браузър не показва, а файлът влиза
  // в първото зареждане на всяка страница.
  const icon = resolve(appDir, 'icon.png');
  await square(256, transparent).toFile(icon);
  console.log(`  ✓ app/icon.png`.padEnd(32) + `${await sizeOf(icon)} KB`);

  // ── Android ──────────────────────────────────────────────────────────────
  for (const size of [192, 512]) {
    const out = resolve(iconsDir, `icon-${size}.png`);
    await square(size, transparent).toFile(out);
    console.log(
      `  ✓ public/icons/icon-${size}.png`.padEnd(32) + `${await sizeOf(out)} KB`,
    );
  }

  // ── Android, с поле за рязане ────────────────────────────────────────────
  const maskable = resolve(iconsDir, 'icon-512-maskable.png');
  const innerSize = Math.round(512 * MASKABLE_SCALE);
  const offset = Math.round((512 - innerSize) / 2);

  const inner = await sharp(found)
    .resize({ width: innerSize, height: innerSize, fit: 'contain', background })
    .png()
    .toBuffer();

  await sharp({ create: { width: 512, height: 512, channels: 4, background } })
    .composite([{ input: inner, top: offset, left: offset }])
    .png({ compressionLevel: 9, palette: true, quality: 92 })
    .toFile(maskable);

  console.log(
    `  ✓ public/icons/icon-512-maskable.png`.padEnd(32) + `${await sizeOf(maskable)} KB`,
  );
  console.log('');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
