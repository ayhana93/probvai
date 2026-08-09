/**
 * ПЛАЩАНИЯ през Stripe.
 *
 * ═══ ЕДНО ПРАВИЛО, ОТ КОЕТО ИЗЛИЗА ВСИЧКО ОСТАНАЛО ═══
 *
 * Кредити се зареждат САМО след потвърдено плащане. Няма плащане — няма
 * кредити. Има плащане, но неуспешно — няма кредити. Затова:
 *
 *   • Сумата се смята ТУК, на сървъра, от броя кредити. Клиентът праща само
 *     число „колко кредита"; ако той пращаше цената, всеки щеше да си купи
 *     200 кредита за един цент.
 *
 *   • Кредитите не се начисляват при създаване на сесията за плащане и не се
 *     начисляват при връщането на потребителя от Stripe. Връщането е само
 *     пренасочване в браузъра — то се симулира с един ред в адресната лента.
 *     Единственият източник на истина е webhook-ът, подписан от Stripe.
 *
 *   • `checkout.session.completed` идва и при неплатена сесия (банков превод,
 *     отложено плащане). Затова гледаме `payment_status === 'paid'`, а не
 *     самото събитие.
 *
 * ═══ ИДЕМПОТЕНТНОСТ — ТРИ ПОЯСА ═══
 *
 * Stripe праща едно и също събитие повече от веднъж. Това не е грешка, а
 * дизайн: при съмнение за неполучено потвърждение той повтаря.
 *
 *   1. `processed_webhooks` — редът с `event.id` се записва ПРЕДИ обработката.
 *      Втори опит удря първичния ключ и излиза веднага.
 *   2. `credit_ledger_ref_once` — частичен уникален индекс: едно начисляване
 *      на `ref_id`. Дори първият пояс да бъде заобиколен, вторият държи.
 *   3. `addCredits` заключва реда с `SELECT ... FOR UPDATE`.
 *
 * Първият пояс сам по себе си НЕ е достатъчен: между записа на събитието и
 * начисляването процесът може да умре. Затова редът в леджера носи
 * `refId = checkout session id` — повторната обработка на същата сесия през
 * друго събитие пак не начислява втори път.
 */

import Stripe from 'stripe';
import { dbSystem, Prisma } from '@probvai/db';
import { addCredits, revokeCredits } from './credits';
import { purchaseEmail } from './emails';
import { env, requireEnv } from './env';
import { sendEmail } from './mail';
import {
  alignRules,
  quote,
  type PriceQuote,
  type PriceRules,
  type QuoteFailure,
  type QuoteResult,
} from './pricing';
import { recordSpend } from './tier';

export type { PriceQuote, PriceRules, QuoteFailure, QuoteResult } from './pricing';

/**
 * Версията на API-то е закована нарочно. Ако някой ден вдигнем библиотеката
 * и Stripe смени формата на обектите, искаме да го видим при компилация,
 * а не в production върху истински плащания.
 */
const STRIPE_API_VERSION = '2025-10-29.clover' as const;

/** Стъпката на плъзгача. Слайдер без стъпка дава суми като €7.43. */
export const PURCHASE_STEP_CREDITS = 5;

let stripe: Stripe | undefined;

export function stripeClient(): Stripe {
  stripe ??= new Stripe(requireEnv('STRIPE_SECRET_KEY', 'плащания през Stripe'), {
    apiVersion: STRIPE_API_VERSION,
    // Мрежата към Stripe пада. Три опита, преди да кажем на човека „не стана".
    maxNetworkRetries: 3,
    timeout: 20_000,
  });
  return stripe;
}

/** Само за тестове — следващото извикване вдига нов клиент. */
export function resetStripeClient(): void {
  stripe = undefined;
}

// ---------------------------------------------------------------------------
// Цената
// ---------------------------------------------------------------------------

/**
 * Правилата на покупката, както са зададени в средата.
 *
 * ═══ ЗАЩО ЕКРАНЪТ ГИ ПИТА, А НЕ ГИ ЗНАЕ ═══
 *
 * Екранът за зареждане ги носеше сам: цена 0.20, минимум 25, таван 200,
 * записани в компонента. Средата междувременно казваше 1000. Резултатът беше
 * плъзгач, който спира на 200 без причина, и цена на екрана, която щеше да се
 * разминава с истинската в мига, в който някой пипне `CREDIT_PRICE_EUR`.
 *
 * Сега числата излизат оттук и стигат до браузъра през `GET /api/checkout`.
 * Едно място за истината, а не две, които рано или късно се разминават.
 */
export function purchaseRules(): PriceRules {
  return alignRules({
    pricePerCredit: env.CREDIT_PRICE_EUR,
    min: env.MIN_PURCHASE_CREDITS,
    max: env.MAX_PURCHASE_CREDITS,
    step: PURCHASE_STEP_CREDITS,
  });
}

/**
 * Смята цената на пакет проби по правилата от средата.
 *
 * Отделена е от route handler-а нарочно: тестът я вика директно, а
 * `/api/checkout` и екранът за зареждане ползват едно и също число.
 */
export function quoteCredits(credits: unknown): QuoteResult {
  return quote(credits, purchaseRules());
}

// ---------------------------------------------------------------------------
// Сесия за плащане
// ---------------------------------------------------------------------------

export type CheckoutInput = {
  userId: string;
  email: string;
  credits: number;
};

export type CheckoutResult =
  | { ok: true; url: string; sessionId: string; quote: PriceQuote }
  | { ok: false; reason: QuoteFailure | 'STRIPE_ERROR' };

/**
 * Създава сесия за плащане и връща адреса, към който да пратим човека.
 *
 * `client_reference_id` и `metadata.userId` носят кой плаща. Двете са
 * нарочно дублирани: `client_reference_id` се вижда в справките на Stripe,
 * `metadata` оцелява при копиране на сесията към PaymentIntent.
 */
export async function createCheckoutSession(
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const priced = quoteCredits(input.credits);
  if (!priced.ok) return { ok: false, reason: priced.reason };

  const { quote } = priced;

  try {
    const session = await stripeClient().checkout.sessions.create(
      {
        mode: 'payment',
        // Имейлът идва от сесията, не от формата. Иначе фактурата отива
        // на чужд адрес по избор на купувача.
        customer_email: input.email,
        client_reference_id: input.userId,
        metadata: {
          userId: input.userId,
          credits: String(quote.credits),
        },
        // Дублирано и тук: PaymentIntent-ът е това, което оцелява при
        // спор с банката, а споровете се гледат месеци по-късно.
        payment_intent_data: {
          metadata: {
            userId: input.userId,
            credits: String(quote.credits),
          },
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'eur',
              unit_amount: quote.amountCents,
              /**
                ═══ ЗАЩО „ПРОБИ", А НЕ „КРЕДИТИ" ═══

                Този надпис не стои при нас. Той е на страницата за плащане на
                Stripe, в разписката и в извлечението от банката — тоест на
                трите места, където човек гледа НАЙ-внимателно. Навсякъде в
                приложението пише „проби"; ако точно тук пише „кредити", в мига
                на плащането излиза дума, която купувачът вижда за пръв път. */
              product_data: {
                name: `${quote.credits} проби за ПРОБВАЙ`,
                description: 'Една проба е едно генериране. Пробите не изтичат.',
              },
            },
          },
        ],
        success_url: `${env.APP_URL}/krediti/uspeh?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.APP_URL}/krediti?otkazano=1`,
        locale: 'bg',
        // Сесията живее час. След това цената може да е друга.
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      },
      {
        // Двойно натискане на „Зареди" не бива да прави две сесии за плащане.
        // Ключът се сменя на всеки пет минути, за да може човек все пак да
        // започне отново, ако е затворил прозореца.
        idempotencyKey: `checkout:${input.userId}:${quote.credits}:${Math.floor(
          Date.now() / 300_000,
        )}`,
      },
    );

    if (!session.url) {
      return { ok: false, reason: 'STRIPE_ERROR' };
    }

    return { ok: true, url: session.url, sessionId: session.id, quote };
  } catch (error) {
    console.error('[плащания] Stripe отказа да създаде сесия:', error);
    return { ok: false, reason: 'STRIPE_ERROR' };
  }
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

export type WebhookOutcome =
  | 'CREDITED'
  | 'REVOKED'
  | 'DUPLICATE'
  | 'IGNORED'
  | 'UNPAID'
  | 'BAD_METADATA';

/**
 * Проверява подписа на Stripe и връща събитието.
 *
 * ⚠ Тялото трябва да е СУРОВО. Ако някъде по пътя мине през `JSON.parse` и
 * обратно през `JSON.stringify`, подписът няма да съвпадне — и това е добре:
 * подпис върху пренаписан текст не доказва нищо.
 */
export function verifyWebhook(rawBody: string, signature: string | null): Stripe.Event | null {
  if (!signature) return null;

  try {
    return stripeClient().webhooks.constructEvent(
      rawBody,
      signature,
      requireEnv('STRIPE_WEBHOOK_SECRET', 'проверка на подписа на Stripe'),
    );
  } catch (error) {
    // Невалиден подпис значи, че някой се представя за Stripe. Не логваме
    // тялото — то е негово, не наше.
    console.warn(
      '[плащания] отхвърлен webhook с невалиден подпис:',
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Записва събитието като обработено.
 * Връща `false`, ако вече е било — тогава не правим нищо повече.
 */
async function claimEvent(event: Stripe.Event): Promise<boolean> {
  try {
    await dbSystem().processedWebhook.create({
      data: { id: event.id, type: event.type },
    });
    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return false;
    }
    throw error;
  }
}

/** Вади userId и броя кредити от метаданните, с проверка. */
function readMetadata(
  metadata: Stripe.Metadata | null,
  clientReferenceId?: string | null,
): { userId: string; credits: number } | null {
  const userId = metadata?.userId ?? clientReferenceId ?? '';
  const credits = Number(metadata?.credits);

  if (!userId || !Number.isInteger(credits) || credits <= 0) return null;
  return { userId, credits };
}

/**
 * Обработва подписано събитие от Stripe.
 *
 * Всичко, което не разбираме, се приема тихо. Отговор 4xx кара Stripe да
 * повтаря събитието дни наред и накрая да изключи endpoint-а.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<WebhookOutcome> {
  if (!(await claimEvent(event))) return 'DUPLICATE';

  switch (event.type) {
    // Обикновено плащане с карта — идва веднага след успех.
    case 'checkout.session.completed':
    // Отложени методи (банков превод). Първото събитие идва с
    // `payment_status: 'unpaid'`, това идва, когато парите пристигнат.
    case 'checkout.session.async_payment_succeeded':
      return creditFromSession(event.data.object);

    case 'charge.refunded':
      return revokeFromCharge(event.data.object);

    default:
      return 'IGNORED';
  }
}

async function creditFromSession(
  session: Stripe.Checkout.Session,
): Promise<WebhookOutcome> {
  // ⚠ САМО платените. `completed` не значи „платено".
  if (session.payment_status !== 'paid') return 'UNPAID';

  const meta = readMetadata(session.metadata, session.client_reference_id);
  if (!meta) {
    console.error('[плащания] платена сесия без метаданни:', session.id);
    return 'BAD_METADATA';
  }

  // `refId` е id-то на сесията. Второ събитие за същата сесия удря
  // уникалния индекс и не начислява втори път.
  const result = await addCredits(meta.userId, meta.credits, 'PURCHASE', session.id);

  if (!result.ok) {
    if (result.reason === 'ALREADY_GRANTED') return 'DUPLICATE';
    console.error(
      `[плащания] платена сесия ${session.id}, но кредитите не влязоха: ${result.reason}`,
    );
    return 'BAD_METADATA';
  }

  // Похарченото води до VIP Closet. Записва се СЛЕД начисляването и само
  // ако то е минало — иначе прагът щеше да се движи от неслучили се покупки.
  await recordSpend(meta.userId, session.amount_total ?? 0);

  // Потвърждението тръгва последно и провалът му не проваля покупката.
  // Кредитите са в човека; ако писмото не стигне, това е неудобство, а
  // отговор различен от 2xx би накарал Stripe да повтори цялото събитие.
  const to = session.customer_email ?? session.customer_details?.email ?? null;
  if (to) {
    const amountEur = ((session.amount_total ?? 0) / 100).toFixed(2);
    const letter = purchaseEmail({
      credits: meta.credits,
      amountEur,
      balance: result.balance,
      appUrl: env.APP_URL,
    });

    const sent = await sendEmail({ to, ...letter });
    if (!sent.ok) {
      console.error(`[плащания] потвърждението за ${session.id} не тръгна: ${sent.error}`);
    }
  }

  return 'CREDITED';
}

/**
 * Връщане на пари → отнемане на кредити.
 *
 * Балансът не пада под нула. Ако човекът вече е изхарчил купеното, отнемаме
 * колкото има; остатъкът е наша загуба и се вижда в леджера.
 */
async function revokeFromCharge(charge: Stripe.Charge): Promise<WebhookOutcome> {
  const meta = readMetadata(charge.metadata);
  if (!meta) return 'BAD_METADATA';

  // Частично връщане отнема пропорционален брой кредити.
  const share = charge.amount > 0 ? charge.amount_refunded / charge.amount : 1;
  const toRevoke = Math.min(meta.credits, Math.round(meta.credits * share));
  if (toRevoke <= 0) return 'IGNORED';

  const result = await revokeCredits(meta.userId, toRevoke, `refund:${charge.id}`);
  if (!result.ok) return 'DUPLICATE';

  // Върнатите пари слизат и от сметката за VIP Closet. Иначе статусът
  // остава отключен за покупка, която вече не съществува.
  await recordSpend(meta.userId, -charge.amount_refunded);

  return 'REVOKED';
}
