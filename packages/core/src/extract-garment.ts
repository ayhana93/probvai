/**
 * ИЗВЛИЧАНЕ НА ДРЕХА ОТ ЛИНК
 *
 * Човекът поставя адрес от Shein, Vinted, Zalando... Ние отваряме
 * страницата, вземаме `og:image`, сваляме снимката, проверяваме я и я
 * качваме в R2. Оттам нататък генерацията работи само с ключове в R2 и
 * никога с чужди адреси.
 *
 * Всяко обръщение навън минава през `safeFetch` — виж `net-guard.ts` за
 * защитата от SSRF. Тук няма нито един гол `fetch`.
 */

import { env } from './env';
import { linkHref, metaContent, pageTitle } from './html-meta';
import { affiliateUrl, merchantFor, type Merchant } from './merchants';
import { BlockedRequestError, parsePublicUrl, safeFetch } from './net-guard';
import { buildKey, putObject } from './storage';
import { prepareUserImage } from './image';

export type ExtractFailure =
  | 'BAD_URL'
  | 'BLOCKED'
  | 'NO_IMAGE_FOUND'
  | 'IMAGE_UNUSABLE'
  | 'FETCH_FAILED';

export type ExtractResult =
  | {
      ok: true;
      /** Ключът в R2 — това подаваме после на /api/generate. */
      garmentKey: string;
      /** Име на дрехата от заглавието на страницата, ако го има. */
      title: string | null;
      merchant: string | null;
      /** Партньорска връзка за бутона „Купи я", ако има настроена мрежа. */
      affiliateUrl: string;
    }
  | { ok: false; reason: ExtractFailure; message: string };

/** Мета таговете, в които магазините слагат снимката на продукта. */
const IMAGE_META = [
  'og:image:secure_url',
  'og:image:url',
  'og:image',
  'twitter:image',
  'twitter:image:src',
];

export async function extractGarment(
  userId: string,
  rawUrl: string,
): Promise<ExtractResult> {
  // ── 1. Адресът ───────────────────────────────────────────────────────────
  let productUrl: URL;
  try {
    productUrl = parsePublicUrl(rawUrl);
  } catch (error) {
    if (error instanceof BlockedRequestError) {
      return {
        ok: false,
        reason: error.reason === 'PRIVATE_ADDRESS' ? 'BLOCKED' : 'BAD_URL',
        message: 'Този адрес не става. Копирай линка от магазина.',
      };
    }
    throw error;
  }

  const merchant = merchantFor(productUrl.hostname);

  // ── 2. Страницата ────────────────────────────────────────────────────────
  let page: Awaited<ReturnType<typeof safeFetch>>;
  try {
    page = await safeFetch(productUrl.toString(), {
      timeoutMs: env.EXTRACT_TIMEOUT_MS,
      maxBytes: env.EXTRACT_MAX_BYTES,
      allowedContentTypes: ['text/html', 'application/xhtml+xml'],
    });
  } catch (error) {
    return failure(error, 'Магазинът не отговори. Пробвай да качиш снимка.');
  }

  const html = new TextDecoder('utf-8').decode(page.body);

  // ── 3. Снимката ──────────────────────────────────────────────────────────
  const rawImage = metaContent(html, IMAGE_META) ?? linkHref(html, 'image_src');
  if (!rawImage) {
    return {
      ok: false,
      reason: 'NO_IMAGE_FOUND',
      message: 'Не намерих снимка на тази страница. Качи я на ръка.',
    };
  }

  // Адресът може да е относителен спрямо страницата след пренасочванията.
  let imageUrl: URL;
  try {
    imageUrl = parsePublicUrl(new URL(rawImage, page.url).toString());
  } catch {
    return {
      ok: false,
      reason: 'BLOCKED',
      message: 'Снимката е на адрес, който не мога да отворя.',
    };
  }

  let downloaded: Awaited<ReturnType<typeof safeFetch>>;
  try {
    downloaded = await safeFetch(imageUrl.toString(), {
      timeoutMs: env.EXTRACT_TIMEOUT_MS,
      maxBytes: env.UPLOAD_MAX_BYTES,
      accept: 'image/*',
      allowedContentTypes: ['image/'],
    });
  } catch (error) {
    return failure(error, 'Снимката не се свали. Пробвай да я качиш на ръка.');
  }

  // ── 4. Проверка и качване ────────────────────────────────────────────────
  // Минава през същата проверка като качен файл: magic bytes, декодиране,
  // смаляване, махане на метаданните. Това, че идва от магазин, не значи,
  // че ѝ вярваме.
  const prepared = await prepareUserImage(downloaded.body);
  if (!prepared.ok) {
    return {
      ok: false,
      reason: 'IMAGE_UNUSABLE',
      message: 'Снимката от магазина не става за проба. Качи друга.',
    };
  }

  const key = buildKey(userId, 'garment', prepared.image.extension);
  await putObject(key, prepared.image.data, prepared.image.contentType);

  return {
    ok: true,
    garmentKey: key,
    title: pageTitle(html),
    merchant: merchant?.name ?? null,
    affiliateUrl: affiliateUrl(productUrl.toString(), merchant),
  };
}

function failure(error: unknown, message: string): ExtractResult {
  if (error instanceof BlockedRequestError) {
    return {
      ok: false,
      reason: error.reason === 'PRIVATE_ADDRESS' ? 'BLOCKED' : 'FETCH_FAILED',
      message:
        error.reason === 'PRIVATE_ADDRESS'
          ? 'Този адрес не става. Копирай линка от магазина.'
          : message,
    };
  }
  throw error;
}

export type { Merchant };
