import { createCheckoutSession, quoteCredits, type QuoteFailure } from '@probvai/core';
import { jsonError, readJson, requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/checkout  →  { url }
 *
 * Клиентът праща САМО броя кредити. Сумата се смята на сървъра — иначе
 * всеки може да си купи 200 кредита за един цент, като промени едно поле
 * в заявката.
 *
 * Тук не се начисляват кредити. Тук дори не се знае дали ще има плащане.
 * Начисляването е в `/api/webhooks/stripe`, срещу подпис от Stripe.
 */

const MESSAGES: Record<QuoteFailure | 'STRIPE_ERROR', { status: number; text: string }> = {
  NOT_A_NUMBER: { status: 400, text: 'Броят кредити не е валиден.' },
  BELOW_MINIMUM: { status: 400, text: 'Минималната покупка е 25 кредита.' },
  ABOVE_MAXIMUM: { status: 400, text: 'Наведнъж може да заредиш най-много 200 кредита.' },
  BAD_STEP: { status: 400, text: 'Броят кредити трябва да е кратен на 5.' },
  STRIPE_ERROR: {
    status: 502,
    text: 'Плащането не тръгна. Пробвай пак след минута.',
  },
};

type Body = { credits?: unknown };

export async function POST(request: Request): Promise<Response> {
  const session = await requireUser();
  if (session.response) return session.response;

  const body = await readJson<Body>(request);
  if (!body) {
    return jsonError(400, 'BAD_REQUEST', 'Заявката не е правилно оформена.');
  }

  // Проверяваме два пъти: веднъж тук за бърз и ясен отказ, и веднъж навътре
  // в `createCheckoutSession`, за да няма път до Stripe без проверка.
  const priced = quoteCredits(body.credits);
  if (!priced.ok) {
    const { status, text } = MESSAGES[priced.reason];
    return jsonError(status, priced.reason, text);
  }

  if (!session.user.email) {
    return jsonError(400, 'NO_EMAIL', 'Профилът няма имейл за фактурата.');
  }

  const result = await createCheckoutSession({
    userId: session.user.id,
    email: session.user.email,
    credits: priced.quote.credits,
  });

  if (!result.ok) {
    const { status, text } = MESSAGES[result.reason];
    return jsonError(status, result.reason, text);
  }

  return Response.json({ url: result.url, amountEur: result.quote.amountEur });
}
