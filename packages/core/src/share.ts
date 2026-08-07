/**
 * КАРТИНКА ЗА СПОДЕЛЯНЕ
 *
 * Заданието го казва направо: споделянето е основният канал за растеж.
 * Затова тази картинка не е „резултатът, но по-висок" — тя е нарочно
 * направена за Story.
 *
 * Три решения:
 *
 * 1. ФОНЪТ Е ИЗВАДЕН ОТ САМАТА СНИМКА — силно размита и потъмнена нейна
 *    версия. Плътен цвят зад снимка с друга гама изглежда като грешка;
 *    размитата снимка винаги пасва, защото е същите цветове.
 *
 * 2. РЕЗУЛТАТЪТ НЕ СЕ РЕЖЕ. Побира се цял и се центрира. Отрязана глава
 *    в Story е по-лошо от малко празно отгоре.
 *
 * 3. НАДПИСЪТ Е ДИСКРЕТЕН. Долу, малък, върху тъмна лента. Story-то е на
 *    човека, не наша реклама — грамаден воден знак не се споделя.
 */

import sharp from 'sharp';

/** 1080×1920 — Story на Instagram, TikTok и всичко останало. */
const WIDTH = 1080;
const HEIGHT = 1920;

/** Отстъп отстрани, за да не опира снимката в ръба на екрана. */
const SIDE_PADDING = 72;

/** Височина на лентата с надписа долу. */
const FOOTER = 190;

function footerSvg(caption: string): Buffer {
  return Buffer.from(`<svg width="${WIDTH}" height="${FOOTER}" xmlns="http://www.w3.org/2000/svg">
  <text x="${WIDTH / 2}" y="${FOOTER / 2 - 6}"
        text-anchor="middle" dominant-baseline="central"
        font-family="DejaVu Sans, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="46" font-weight="bold" letter-spacing="3"
        fill="#ffffff" fill-opacity="0.96">${caption}</text>
  <text x="${WIDTH / 2}" y="${FOOTER / 2 + 46}"
        text-anchor="middle" dominant-baseline="central"
        font-family="DejaVu Sans, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="26" letter-spacing="2"
        fill="#ffffff" fill-opacity="0.6">пробвай преди да поръчаш</text>
</svg>`);
}

export type ShareImageOptions = {
  /** Надписът долу. По подразбиране адресът на сайта. */
  caption?: string;
};

/**
 * Прави 1080×1920 картинка за Story от готовия резултат.
 */
export async function buildShareImage(
  result: Uint8Array,
  options: ShareImageOptions = {},
): Promise<Buffer> {
  const caption = options.caption ?? 'probvai.bg';
  const source = Buffer.from(result);

  // ── Фонът: същата снимка, размита и потъмнена ──────────────────────────
  const background = await sharp(source)
    .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'attention' })
    .blur(60)
    .modulate({ brightness: 0.42, saturation: 1.15 })
    .toBuffer();

  // ── Резултатът: побира се цял, без рязане ──────────────────────────────
  const available = {
    width: WIDTH - SIDE_PADDING * 2,
    height: HEIGHT - FOOTER - SIDE_PADDING * 2,
  };

  const foreground = await sharp(source)
    .resize(available.width, available.height, {
      fit: 'inside',
      withoutEnlargement: false,
    })
    .toBuffer();

  const size = await sharp(foreground).metadata();
  const fgWidth = size.width ?? available.width;
  const fgHeight = size.height ?? available.height;

  const left = Math.round((WIDTH - fgWidth) / 2);
  const top = Math.round((HEIGHT - FOOTER - fgHeight) / 2);

  // Меко тъмно поле точно зад снимката — отделя я от размития фон.
  const shadow = Buffer.from(
    `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${left - 10}" y="${top - 10}" width="${fgWidth + 20}" height="${fgHeight + 20}"
            rx="34" fill="#000000" fill-opacity="0.34"/>
    </svg>`,
  );

  return sharp(background)
    .composite([
      { input: shadow, top: 0, left: 0 },
      { input: foreground, top, left },
      { input: footerSvg(caption), top: HEIGHT - FOOTER, left: 0 },
    ])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}
