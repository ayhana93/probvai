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

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { dbSystem } from '@probvai/db';
import { env } from './env';

/**
 * Купувал ли е този потребител кредити.
 *
 * Сумата, а не наличието на ред. Върнатото плащане също е ред с вид PURCHASE,
 * само че с отрицателна стойност — сумата се връща на нула и водният знак се
 * връща с нея. Без това човек, поискал парите си обратно, продължава да
 * получава чисти снимки безплатно.
 *
 * Частично върнато плащане оставя сумата положителна и човекът остава чист.
 * Това е нарочно: платил е за част, тя си е негова.
 */
export async function hasEverPurchased(userId: string): Promise<boolean> {
  const purchased = await dbSystem().creditLedger.aggregate({
    where: { userId, reason: 'PURCHASE' },
    _sum: { delta: true },
  });
  return (purchased._sum.delta ?? 0) > 0;
}

/** Трябва ли резултатът на този потребител да носи воден знак. */
export async function shouldWatermark(userId: string): Promise<boolean> {
  return !(await hasEverPurchased(userId));
}

/**
 * ═══ ШРИФТЪТ СЕ ИЗБИРА ИЗРИЧНО ═══
 *
 * Надписът се рисува от librsvg, не от браузър. Тя няма представа какво е
 * `-apple-system` и разчита изцяло на fontconfig в самия контейнер.
 *
 * Затова „DejaVu Sans" стои ПРЪВ: той се слага нарочно в `Dockerfile.worker`
 * и има кирилица. Останалите са за работа на машина за разработка, където
 * DejaVu може да го няма.
 *
 * ⚠ Липсва ли изобщо шрифт, това НЕ гърми — снимката излиза с празни
 * квадратчета вместо букви. Затова шрифтът е част от образа, не пожелание.
 */
const FONT_STACK = 'DejaVu Sans, -apple-system, Segoe UI, Roboto, sans-serif';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * ═══ ЗНАКЪТ Е КАРТИНКА, А НЕ НАДПИС ═══
 *
 * Дотук се рисуваше текст в SVG. Това значеше, че готовата снимка зависи от
 * това дали в контейнера има шрифт — а в първия истински образ нямаше, и
 * знакът излизаше като редица празни квадратчета, без нищо да се оплаче.
 *
 * Логото е картинка. Слагането на картинка върху картинка не иска шрифтове,
 * не иска fontconfig и изглежда еднакво навсякъде.
 *
 * ⚠ Файлът е в `packages`, не в `apps/web/public`. Знакът се налага от
 * РАБОТНИКА, а неговият образ носи само `packages`, `scripts` и
 * `package.json` — от `public` там няма нищо.
 */
function markPath(): string {
  /**
   * ⚠ Пътят се СГЛОБЯВА, не се пише като литерал в `new URL(...)`.
   *
   * Написан така, webpack го вижда като внасяне на модул и `next build`
   * пада с „Can't resolve '../assets/watermark.png'". Файлът обаче не е
   * модул — той е ресурс, който се чете при работа, и то само от работника.
   *
   * Пътят се смята и ВЪТРЕ във функция, не на ниво модул: така нищо не се
   * изпълнява само защото файлът е внесен от билда.
   */
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, '..', 'assets', 'watermark.png');
}

/** Каква част от широчината заема знакът. */
const MARK_WIDTH_RATIO = 0.22;

/** Разстояние от ъгъла, също спрямо широчината — на всяка снимка еднакво. */
const MARK_MARGIN_RATIO = 0.035;

/**
 * Прочитаният файл се пази. Работникът прави хиляди снимки и няма причина
 * да чете един и същ файл от диска за всяка.
 *
 * `null` значи „проверено е и го няма" — тогава се пада на надписа отдолу,
 * вместо снимката да излезе без никакъв знак.
 */
let markCache: Buffer | null | undefined;

function loadMark(): Buffer | null {
  if (markCache !== undefined) return markCache;
  try {
    markCache = readFileSync(markPath());
  } catch {
    console.warn(`[воден знак] липсва ${markPath()} — падам на надпис.`);
    markCache = null;
  }
  return markCache;
}

/** Само за тестове — кара следващото налагане да прочете файла наново. */
export function resetWatermarkCache(): void {
  markCache = undefined;
}

/**
 * Резервният надпис.
 *
 * Ползва се САМО когато картинката липсва. Нарочно е същият размер и на
 * същото място, за да не се получи снимка, която изглежда като от друго
 * приложение, ако някой ден файлът изпадне от образа.
 */
function fallbackSvg(width: number, markWidth: number, markHeight: number, text: string): Buffer {
  const label = escapeXml(text);
  const font = Math.max(11, Math.round(markWidth * 0.2));

  return Buffer.from(`<svg width="${markWidth}" height="${markHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${markWidth}" height="${markHeight}" rx="${Math.round(markHeight / 2)}"
        fill="#000000" fill-opacity="0.38"/>
  <text x="${markWidth / 2}" y="${markHeight / 2}"
        text-anchor="middle" dominant-baseline="central"
        font-family="${FONT_STACK}" font-size="${font}" font-weight="700"
        fill="#ffffff" fill-opacity="0.9">${label}</text>
</svg>`);
}

/**
 * Налага водния знак и връща новото изображение.
 *
 * ═══ ЕДИН ЗНАК, ДОЛУ ВДЯСНО, МАЛЪК ═══
 *
 * Преди знакът беше и лента през целия долен край, и повтарящ се диагонален
 * надпис през цялата снимка. Това пазеше повече, но разваляше снимката — а
 * безплатните проби се СПОДЕЛЯТ и точно това е основният ни канал за
 * растеж. Знак, който прави снимката грозна, убива канала, който трябва да
 * храни.
 *
 * Затова: един малък знак в долния десен ъгъл. Може да се изреже — и това
 * е приемливо. Целта му е да казва откъде идва снимката, не да я заключва.
 */
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

  const markWidth = Math.max(80, Math.round(width * MARK_WIDTH_RATIO));
  const margin = Math.round(width * MARK_MARGIN_RATIO);

  const file = loadMark();

  let overlay: Buffer;
  let markHeight: number;

  if (file) {
    // Смалява се веднъж, до истинската широчина. Подаден в пълен размер,
    // sharp щеше да откаже да го наложи върху по-малка снимка.
    const resized = await sharp(file)
      .resize({ width: markWidth, withoutEnlargement: false })
      .png()
      .toBuffer();

    markHeight = (await sharp(resized).metadata()).height ?? 0;

    /**
     * ═══ ПРОЗРАЧНОСТТА СЕ ВПИСВА В САМИЯ ЗНАК ═══
     *
     * `composite` няма `opacity` — има само `blend`. Затова алфата на знака
     * се умножава предварително: бяло правоъгълниче с 82% през `dest-in`
     * изрязва точно толкова от плътността му.
     *
     * Другата възможност беше `ensureAlpha`, но той пипа само файлове БЕЗ
     * алфа — а нашият знак е PNG с прозрачност и там не прави нищо.
     */
    overlay = await sharp(resized)
      .composite([
        {
          input: Buffer.from(
            `<svg width="${markWidth}" height="${markHeight}" xmlns="http://www.w3.org/2000/svg">` +
              `<rect width="${markWidth}" height="${markHeight}" fill="#ffffff" fill-opacity="0.82"/></svg>`,
          ),
          blend: 'dest-in',
        },
      ])
      .png()
      .toBuffer();
  } else {
    markHeight = Math.round(markWidth * 0.34);
    overlay = fallbackSvg(width, markWidth, markHeight, text);
  }

  return source
    .composite([
      {
        input: overlay,
        top: Math.max(0, height - markHeight - margin),
        left: Math.max(0, width - markWidth - margin),
        blend: 'over',
      },
    ])
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}
