import {
  DEFAULT_ASPECT_RATIO,
  isAllowedAspectRatio,
  startGeneration,
  type StartGenerationFailure,
} from '@probvai/core';
import { jsonError, readJson, requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Съобщенията към потребителя.
 *
 * ⚠ При достигнат ГЛОБАЛЕН таван НЕ казваме „свършиха ни парите". Казваме,
 * че сме претоварени. Точната причина е наша работа, не негова.
 */
const MESSAGES: Record<StartGenerationFailure, { status: number; text: string }> = {
  BAD_ASPECT_RATIO: { status: 400, text: 'Това съотношение не се поддържа.' },
  NOT_YOUR_FILE: { status: 403, text: 'Тази снимка не е твоя.' },
  COOLDOWN: { status: 429, text: 'Изчакай малко преди следващата проба.' },
  USER_DAILY_LIMIT: {
    status: 429,
    text: 'Стигна дневния лимит. Пробвай пак утре.',
  },
  GLOBAL_DAILY_CAP: {
    status: 503,
    text: 'В момента сме претоварени. Пробвай пак след час.',
  },
  MAINTENANCE: {
    status: 503,
    text: 'Правим поддръжка. Ще работим пак съвсем скоро.',
  },
  INSUFFICIENT_CREDITS: { status: 402, text: 'Нямаш кредити. Зареди, за да продължиш.' },
  USER_SUSPENDED: { status: 403, text: 'Профилът ти е спрян. Пиши ни.' },
  USER_NOT_FOUND: { status: 401, text: 'Трябва да влезеш в профила си.' },
};

type Body = {
  personKey?: unknown;
  garmentKey?: unknown;
  aspectRatio?: unknown;
  source?: unknown;
  merchant?: unknown;
  productUrl?: unknown;
};

/**
 * POST /api/generate
 *
 * Редът на стъпките е в `packages/core/src/generation.ts` и не се променя:
 * кредитът се удържа ПРЕДИ обръщението към доставчика.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await requireUser();
  if (session.response) return session.response;

  const body = await readJson<Body>(request);
  if (!body) {
    return jsonError(400, 'BAD_REQUEST', 'Заявката не е правилно оформена.');
  }

  if (typeof body.personKey !== 'string' || typeof body.garmentKey !== 'string') {
    return jsonError(400, 'BAD_REQUEST', 'Трябват и двете снимки.');
  }

  // Съотношението се проверява тук и още веднъж по-навътре. Всичко извън
  // списъка е отказ БЕЗ харчене на кредит.
  const aspectRatio =
    body.aspectRatio === undefined ? DEFAULT_ASPECT_RATIO : body.aspectRatio;
  if (!isAllowedAspectRatio(aspectRatio)) {
    return jsonError(400, 'BAD_ASPECT_RATIO', MESSAGES.BAD_ASPECT_RATIO.text);
  }

  // Само „LINK" се приема като линк. Всичко останало е качена снимка —
  // и тогава името на магазина не се записва, защото не го знаем.
  const source = body.source === 'LINK' ? 'LINK' : 'UPLOAD';

  const result = await startGeneration({
    userId: session.user.id,
    personKey: body.personKey,
    garmentKey: body.garmentKey,
    aspectRatio,
    source,
    merchant: typeof body.merchant === 'string' ? body.merchant : null,
    productUrl: typeof body.productUrl === 'string' ? body.productUrl : null,
  });

  if (!result.ok) {
    const { status, text } = MESSAGES[result.reason];
    const headers: Record<string, string> = {};
    if (result.retryAfterSeconds) {
      headers['retry-after'] = String(result.retryAfterSeconds);
    }

    return Response.json(
      {
        error: {
          code: result.reason,
          message: text,
          ...(result.retryAfterSeconds
            ? { retryAfterSeconds: result.retryAfterSeconds }
            : {}),
        },
      },
      { status, headers },
    );
  }

  return Response.json(
    { generationId: result.generationId, balance: result.balance },
    { status: 202 },
  );
}
