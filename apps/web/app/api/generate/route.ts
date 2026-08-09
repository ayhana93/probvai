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
  INSUFFICIENT_CREDITS: { status: 402, text: 'Нямаш проби. Зареди, за да продължиш.' },
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
  prompt?: unknown;
};

/**
 * Дължината на текста към доставчика.
 *
 * ═══ ЗАЩО СЕ РЕЖЕ, А НЕ СЕ ОТКАЗВА ═══
 *
 * Отказана заявка заради дълъг текст значи изгубено писане и нула проби.
 * Отрязаният текст значи проба, направена по първите триста знака — а
 * същественото при такова описание е винаги в началото.
 *
 * Полето в интерфейса и без това не пуска повече; това тук е за всичко,
 * което идва по друг път.
 */
const MAX_PROMPT = 300;

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

  if (typeof body.garmentKey !== 'string' || body.garmentKey.length === 0) {
    return jsonError(400, 'NO_GARMENT', 'Избери снимка на дрехата.');
  }

  /**
   * ═══ СНИМКАТА НА ЧОВЕКА ИДВА В ЗАЯВКАТА, ВИНАГИ ═══
   *
   * Тук имаше отстъпка: липсва ли `personKey`, се взимаше запазената снимка
   * на профила. Тя обаче е „последната качена", а това не е същото като
   * „снимката, с която човекът иска да пробва" — и когато последното качено
   * се окажеше профилна снимка, пробата тръгваше с нея.
   *
   * Затова стъпка 1 вече започва празна и ключът се подава изрично. Отказът
   * тук е последната преграда: по-добре ясна грешка, отколкото изхарчен
   * кредит върху грешната снимка.
   */
  if (typeof body.personKey !== 'string' || body.personKey.length === 0) {
    return jsonError(400, 'NO_PERSON_PHOTO', 'Качи своя снимка на стъпка 1.');
  }

  const personKey = body.personKey;

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

  // Един ред, без празни краища. Текст с нови редове не носи повече смисъл
  // на доставчика, а прави записа в базата по-труден за четене.
  const prompt =
    typeof body.prompt === 'string'
      ? body.prompt.replace(/\s+/g, ' ').trim().slice(0, MAX_PROMPT)
      : '';

  const result = await startGeneration({
    userId: session.user.id,
    personKey,
    garmentKey: body.garmentKey,
    aspectRatio,
    prompt: prompt.length > 0 ? prompt : null,
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
