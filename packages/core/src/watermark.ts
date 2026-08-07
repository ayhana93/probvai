/**
 * ВОДЕН ЗНАК
 *
 * Издърпан от Фаза 6, защото работникът от Фаза 2 го налага в момента на
 * качване — след това резултатът вече е в R2 и връщане назад няма.
 *
 * ═══ КОЯ ГЕНЕРАЦИЯ Е „БЕЗПЛАТНА" ═══
 *
 * Кредитът си е кредит — след харчене не се вижда откъде е дошъл. Затова
 * правилото е просто и разбираемо: воден знак носят генерациите на
 * потребител, който НИКОГА не е купувал кредити.
 *
 * Купи ли веднъж, всичко след това излиза чисто. Това е и обещанието на
 * бутона „Махни водния знак".
 *
 * Знакът е дискретен, но не се маха с изрязване: лента в долния край,
 * плюс повторен диагонален надпис през средата с ниска непрозрачност.
 */

import sharp from 'sharp';
import { dbSystem } from '@probvai/db';
import { env } from './env';

/** Купувал ли е този потребител кредити. */
export async function hasEverPurchased(userId: string): Promise<boolean> {
  const purchase = await dbSystem().creditLedger.findFirst({
    where: { userId, reason: 'PURCHASE' },
    select: { id: true },
  });
  return purchase !== null;
}

/** Трябва ли резултатът на този потребител да носи воден знак. */
export async function shouldWatermark(userId: string): Promise<boolean> {
  return !(await hasEverPurchased(userId));
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Строи SVG слоя с надписа.
 * Размерите се смятат спрямо снимката, за да изглежда еднакво на всяка.
 */
function overlaySvg(width: number, height: number, text: string): Buffer {
  const label = escapeXml(text);

  const badgeFont = Math.max(14, Math.round(width * 0.038));
  const badgePadX = Math.round(badgeFont * 0.7);
  const badgeHeight = Math.round(badgeFont * 1.9);
  const badgeWidth = Math.round(label.length * badgeFont * 0.56 + badgePadX * 2);
  const badgeX = Math.round((width - badgeWidth) / 2);
  const badgeY = height - badgeHeight - Math.round(height * 0.028);

  const tileFont = Math.max(14, Math.round(width * 0.032));

  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Рядък диагонален надпис. Целта не е да развали снимката, а да остане
         на нея, ако някой изреже лентата долу.
         Безплатните резултати се споделят — това е основният ни канал за
         растеж. Знак, който прави снимката грозна, убива точно този канал. -->
    <pattern id="tile" width="${tileFont * 20}" height="${tileFont * 13}"
             patternUnits="userSpaceOnUse" patternTransform="rotate(-24)">
      <text x="0" y="${tileFont * 6}"
            font-family="-apple-system, Segoe UI, Roboto, sans-serif"
            font-size="${tileFont}" font-weight="600"
            letter-spacing="${(tileFont * 0.08).toFixed(2)}"
            fill="#ffffff" fill-opacity="0.075">${label}</text>
    </pattern>
    <filter id="soften" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000" flood-opacity="0.28"/>
    </filter>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#tile)"/>

  <g filter="url(#soften)">
    <rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="${badgeHeight}"
          rx="${Math.round(badgeHeight / 2)}"
          fill="#000000" fill-opacity="0.42"/>
    <text x="${width / 2}" y="${badgeY + badgeHeight / 2}"
          text-anchor="middle" dominant-baseline="central"
          font-family="-apple-system, Segoe UI, Roboto, sans-serif"
          font-size="${badgeFont}" font-weight="700"
          letter-spacing="${(badgeFont * 0.02).toFixed(2)}"
          fill="#ffffff" fill-opacity="0.92">${label}</text>
  </g>
</svg>`);
}

/** Налага водния знак и връща новото изображение. */
export async function applyWatermark(
  image: Uint8Array,
  text: string = env.WATERMARK_TEXT,
): Promise<Buffer> {
  const source = sharp(Buffer.from(image), { failOn: 'error' });
  const meta = await source.metadata();

  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) {
    throw new Error('Не мога да разчета размерите на изображението за водния знак.');
  }

  return source
    .composite([{ input: overlaySvg(width, height, text), top: 0, left: 0 }])
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}
