import { MAX_USER_PROMPT, startGeneration, type StartGenerationFailure } from '@probvai/core';
import { dbAsUser } from '@probvai/db';
import { jsonError, readJson, requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/generate/{id}/again — същите снимки, нова проба.
 *
 * ═══ КАКЪВ ПРОБЛЕМ РЕШАВА ═══
 *
 * Моделът е генеративен и не дава два еднакви резултата. Понякога първият
 * излиза с променено лице или неестествена стойка. Дотук единственият изход
 * беше да се почне отначало: намери снимката в телефона, качи я, намери
 * дрехата, качи и нея. Заради това хората се отказваха след един лош
 * резултат — не защото приложението не може, а защото вторият опит струваше
 * прекалено много труд.
 *
 * Снимките обаче вече са у нас. Единственото, което трябва, е нов ред в
 * `generations` със същите ключове.
 *
 * ═══ ЗАЩО ПАК СЕ ХАРЧИ ПРОБА ═══
 *
 * Защото доставчикът пак се плаща. Безплатното повтаряне би направило
 * цената ни неограничена за един платен резултат. Копчето казва цената.
 *
 * ═══ ЗАЩО ТЕКСТЪТ МОЖЕ ДА СЕ СМЕНИ ═══
 *
 * Вторият опит обикновено идва с научено: „този път не пипай прическата".
 * Повторение без възможност да се насочи е просто хвърляне на зар.
 *
 * ═══ ЗАЩО СЕ ЧЕТЕ ПРЕЗ `dbAsUser` ═══
 *
 * Row Level Security: чужда генерация не се вижда, дори id-то да е познато.
 * Значи и чужди снимки не могат да бъдат подадени за нова проба.
 */

const MESSAGES: Record<StartGenerationFailure, { status: number; text: string }> = {
  BAD_ASPECT_RATIO: { status: 400, text: 'Това съотношение не се поддържа.' },
  NOT_YOUR_FILE: { status: 403, text: 'Тази снимка не е твоя.' },
  COOLDOWN: { status: 429, text: 'Изчакай малко преди следващата проба.' },
  USER_DAILY_LIMIT: { status: 429, text: 'Стигна дневния лимит. Пробвай пак утре.' },
  GLOBAL_DAILY_CAP: { status: 503, text: 'В момента сме претоварени. Пробвай пак след час.' },
  MAINTENANCE: { status: 503, text: 'Правим поддръжка. Ще работим пак съвсем скоро.' },
  INSUFFICIENT_CREDITS: { status: 402, text: 'Нямаш проби. Зареди, за да продължиш.' },
  USER_SUSPENDED: { status: 403, text: 'Профилът ти е спрян. Пиши ни.' },
  USER_NOT_FOUND: { status: 401, text: 'Трябва да влезеш в профила си.' },
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await requireUser();
  if (session.response) return session.response;

  const { id } = await context.params;
  const body = await readJson<{ prompt?: unknown }>(request);

  const previous = await dbAsUser(session.user.id).generation.findUnique({
    where: { id },
    select: {
      personKey: true,
      garmentKey: true,
      aspectRatio: true,
      prompt: true,
      source: true,
      merchant: true,
      productUrl: true,
    },
  });

  if (!previous) {
    return jsonError(404, 'NOT_FOUND', 'Няма такава проба.');
  }

  /**
   * Липсва ли ново описание, се ползва старото.
   *
   * Разликата между „не съм пипал текста" и „изтрих го нарочно" е важна:
   * първото е undefined, второто е празен низ. Изтритият текст трябва да
   * остане изтрит, иначе повторението не се подчинява на човека.
   */
  const prompt =
    typeof body?.prompt === 'string'
      ? body.prompt.replace(/\s+/g, ' ').trim().slice(0, MAX_USER_PROMPT)
      : (previous.prompt ?? '');

  const result = await startGeneration({
    userId: session.user.id,
    personKey: previous.personKey,
    garmentKey: previous.garmentKey,
    aspectRatio: previous.aspectRatio as never,
    prompt: prompt.length > 0 ? prompt : null,
    source: previous.source,
    merchant: previous.merchant,
    productUrl: previous.productUrl,
  });

  if (!result.ok) {
    const { status, text } = MESSAGES[result.reason];
    return Response.json(
      { error: { code: result.reason, message: text } },
      { status },
    );
  }

  return Response.json(
    { generationId: result.generationId, balance: result.balance },
    { status: 202 },
  );
}
