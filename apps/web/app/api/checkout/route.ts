import {
  createCheckoutSession,
  purchaseRules,
  quoteCredits,
  type PriceRules,
  type QuoteFailure,
} from '@probvai/core';
import { jsonError, readJson, requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET  /api/checkout  →  { pricePerCredit, min, max, step }
 * POST /api/checkout  →  { url }
 *
 * ═══ ЗАЩО ИМА И GET ═══
 *
 * Екранът за зареждане носеше цената и границите записани в себе си: 0.20,
 * минимум 25, таван 200. Средата междувременно казваше таван 1000 — плъзгачът
 * спираше на 200 без причина, а цената на екрана беше добро пожелание, което
 * щеше да се разминае с истинската в мига, в който някой пипне
 * `CREDIT_PRICE_EUR`.
 *
 * Сега екранът пита. Числата са едни и същи от двете страни, защото идват от
 * едно място.
 *
 * ═══ ЗАЩО POST НЕ ВЯРВА НА НИЩО ═══
 *
 * Клиентът праща САМО броя проби. Сумата се смята на сървъра — иначе всеки
 * може да си купи 200 проби за един цент, като промени едно поле в заявката.
 *
 * Тук не се начисляват проби. Тук дори не се знае дали ще има плащане.
 * Начисляването е в `/api/webhooks/stripe`, срещу подпис от Stripe.
 */

/**
 * Съобщенията се сглобяват от ПРАВИЛАТА, не са изписани на ръка.
 *
 * Преди тук пишеше „най-много 200 проби", докато средата разрешаваше 1000.
 * Текст, който повтаря число от конфигурацията, е трето копие на истината —
 * и точно то остава непроменено, когато числото се смени.
 */
function messages(
  rules: PriceRules,
): Record<QuoteFailure | 'STRIPE_ERROR', { status: number; text: string }> {
  return {
    NOT_A_NUMBER: { status: 400, text: 'Броят проби не е валиден.' },
    BELOW_MINIMUM: {
      status: 400,
      text: `Минималната покупка е ${rules.min} проби.`,
    },
    ABOVE_MAXIMUM: {
      status: 400,
      text: `Наведнъж може да заредиш най-много ${rules.max} проби.`,
    },
    BAD_STEP: {
      status: 400,
      text: `Броят проби трябва да е кратен на ${rules.step}.`,
    },
    STRIPE_ERROR: {
      status: 502,
      text: 'Плащането не тръгна. Пробвай пак след минута.',
    },
  };
}

export async function GET(): Promise<Response> {
  const session = await requireUser();
  if (session.response) return session.response;

  return Response.json(purchaseRules(), {
    // Цената може да се смени между два екрана. По-добре една заявка повече,
    // отколкото човек да види стара цена и да плати друга.
    headers: { 'cache-control': 'no-store' },
  });
}

type Body = { credits?: unknown };

export async function POST(request: Request): Promise<Response> {
  const session = await requireUser();
  if (session.response) return session.response;

  const body = await readJson<Body>(request);
  if (!body) {
    return jsonError(400, 'BAD_REQUEST', 'Заявката не е правилно оформена.');
  }

  const texts = messages(purchaseRules());

  // Проверяваме два пъти: веднъж тук за бърз и ясен отказ, и веднъж навътре
  // в `createCheckoutSession`, за да няма път до Stripe без проверка.
  const priced = quoteCredits(body.credits);
  if (!priced.ok) {
    const { status, text } = texts[priced.reason];
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
    const { status, text } = texts[result.reason];
    return jsonError(status, result.reason, text);
  }

  return Response.json({ url: result.url, amountEur: result.quote.amountEur });
}
