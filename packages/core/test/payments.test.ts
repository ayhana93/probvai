/**
 * ПЛАЩАНИЯ — задължителните тестове на Фаза 5.
 *
 * Гейтът на фазата е един: едно и също събитие от Stripe, обработено два
 * пъти, трябва да начисли кредитите ЕДИН път. Stripe повтаря събития по
 * дизайн — това не е рядък случай, а нормалната работа.
 *
 * Тестът не пипа мрежата. `handleStripeEvent` приема вече проверено събитие;
 * проверката на подписа е в `verifyWebhook` и е работа на библиотеката на
 * Stripe, не наша.
 */

import type Stripe from 'stripe';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { dbSystem, disconnectAll } from '@probvai/db';
import { getBalance, getLedgerSum } from '../src/credits';
import { handleStripeEvent, quoteCredits } from '../src/payments';
import { hasEverPurchased } from '../src/watermark';
import { resetEnvCache } from '../src/env';

const system = dbSystem();
const createdUsers: string[] = [];
const createdEvents: string[] = [];

beforeAll(() => {
  // Тестът иска точно тези граници, независимо какво има в .env на машината.
  process.env.CREDIT_PRICE_EUR = '0.20';
  process.env.MIN_PURCHASE_CREDITS = '25';
  process.env.MAX_PURCHASE_CREDITS = '200';
  resetEnvCache();
});

async function makeUser(): Promise<string> {
  const user = await system.user.create({
    data: { email: `pay-${crypto.randomUUID()}@example.test`, credits: 0 },
    select: { id: true },
  });
  createdUsers.push(user.id);
  return user.id;
}

/** Събитие „платена сесия", каквото го праща Stripe. */
function paidSession(
  userId: string,
  credits: number,
  options: { eventId?: string; sessionId?: string; paymentStatus?: string } = {},
): Stripe.Event {
  const eventId = options.eventId ?? `evt_${crypto.randomUUID()}`;
  createdEvents.push(eventId);

  return {
    id: eventId,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: options.sessionId ?? `cs_${crypto.randomUUID()}`,
        payment_status: options.paymentStatus ?? 'paid',
        client_reference_id: userId,
        metadata: { userId, credits: String(credits) },
      },
    },
  } as unknown as Stripe.Event;
}

function refundedCharge(
  userId: string,
  credits: number,
  options: { amount?: number; refunded?: number; chargeId?: string } = {},
): Stripe.Event {
  const eventId = `evt_${crypto.randomUUID()}`;
  createdEvents.push(eventId);

  const amount = options.amount ?? credits * 20;

  return {
    id: eventId,
    type: 'charge.refunded',
    data: {
      object: {
        id: options.chargeId ?? `ch_${crypto.randomUUID()}`,
        amount,
        amount_refunded: options.refunded ?? amount,
        metadata: { userId, credits: String(credits) },
      },
    },
  } as unknown as Stripe.Event;
}

afterEach(async () => {
  if (createdUsers.length > 0) {
    await system.user.deleteMany({ where: { id: { in: createdUsers } } });
    createdUsers.length = 0;
  }
  if (createdEvents.length > 0) {
    await system.processedWebhook.deleteMany({ where: { id: { in: createdEvents } } });
    createdEvents.length = 0;
  }
});

afterAll(async () => {
  await disconnectAll();
});

// ---------------------------------------------------------------------------

describe('Цената се смята на сървъра', () => {
  it('25 кредита са точно €5.00 — минимумът, който пише на екрана', () => {
    const result = quoteCredits(25);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.quote.amountCents).toBe(500);
      expect(result.quote.amountEur).toBe('5.00');
    }
  });

  it('200 кредита са €40.00 — таванът на еднократна покупка', () => {
    const result = quoteCredits(200);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.quote.amountEur).toBe('40.00');
  });

  it('125 кредита не дават 24.999999999999996', () => {
    // 125 * 0.2 в плаваща запетая е 25.000000000000004. Закръглянето на
    // центовете е причината Stripe да получи цяло число, а не боклук.
    const result = quoteCredits(125);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.quote.amountCents).toBe(2500);
      expect(Number.isInteger(result.quote.amountCents)).toBe(true);
    }
  });

  it('под минимума, над максимума и извън стъпката се отказват', () => {
    expect(quoteCredits(20)).toMatchObject({ ok: false, reason: 'BELOW_MINIMUM' });
    expect(quoteCredits(205)).toMatchObject({ ok: false, reason: 'ABOVE_MAXIMUM' });
    expect(quoteCredits(27)).toMatchObject({ ok: false, reason: 'BAD_STEP' });
  });

  it('нечисло, дроб и текст не минават', () => {
    expect(quoteCredits('50')).toMatchObject({ ok: false, reason: 'NOT_A_NUMBER' });
    expect(quoteCredits(50.5)).toMatchObject({ ok: false, reason: 'NOT_A_NUMBER' });
    expect(quoteCredits(null)).toMatchObject({ ok: false, reason: 'NOT_A_NUMBER' });
    expect(quoteCredits(Number.NaN)).toMatchObject({ ok: false, reason: 'NOT_A_NUMBER' });
  });
});

describe('Webhook — гейтът на Фаза 5', () => {
  it('едно и също събитие два пъти начислява кредитите ЕДИН път', async () => {
    const userId = await makeUser();
    const event = paidSession(userId, 50);

    expect(await handleStripeEvent(event)).toBe('CREDITED');
    expect(await handleStripeEvent(event)).toBe('DUPLICATE');

    expect(await getBalance(userId)).toBe(50);
    expect(await getLedgerSum(userId)).toBe(50);
  });

  it('две РАЗЛИЧНИ събития за една и съща сесия също начисляват веднъж', async () => {
    // Втори пояс: `processed_webhooks` пази по event.id, но Stripe може да
    // прати същата сесия през друг вид събитие. Тогава държи уникалният
    // индекс върху `ref_id`.
    const userId = await makeUser();
    const sessionId = `cs_${crypto.randomUUID()}`;

    expect(await handleStripeEvent(paidSession(userId, 50, { sessionId }))).toBe(
      'CREDITED',
    );
    expect(await handleStripeEvent(paidSession(userId, 50, { sessionId }))).toBe(
      'DUPLICATE',
    );

    expect(await getBalance(userId)).toBe(50);
  });

  it('десет едновременни доставки на едно събитие начисляват веднъж', async () => {
    const userId = await makeUser();
    const event = paidSession(userId, 25);

    const outcomes = await Promise.all(
      Array.from({ length: 10 }, () => handleStripeEvent(event)),
    );

    expect(outcomes.filter((outcome) => outcome === 'CREDITED')).toHaveLength(1);
    expect(await getBalance(userId)).toBe(25);
    expect(await getLedgerSum(userId)).toBe(25);
  });

  it('НЕПЛАТЕНА сесия не начислява нищо', async () => {
    // `checkout.session.completed` идва и при отложено плащане. Ако не
    // гледахме `payment_status`, щяхме да раздаваме кредити срещу обещание.
    const userId = await makeUser();

    const outcome = await handleStripeEvent(
      paidSession(userId, 100, { paymentStatus: 'unpaid' }),
    );

    expect(outcome).toBe('UNPAID');
    expect(await getBalance(userId)).toBe(0);
    expect(await getLedgerSum(userId)).toBe(0);
  });

  it('сесия без метаданни не начислява на никого', async () => {
    const event = paidSession('', 50);
    expect(await handleStripeEvent(event)).toBe('BAD_METADATA');
  });

  it('чужд вид събитие се приема тихо, без да пипа кредити', async () => {
    const userId = await makeUser();
    const eventId = `evt_${crypto.randomUUID()}`;
    createdEvents.push(eventId);

    const outcome = await handleStripeEvent({
      id: eventId,
      type: 'customer.created',
      data: { object: {} },
    } as unknown as Stripe.Event);

    expect(outcome).toBe('IGNORED');
    expect(await getBalance(userId)).toBe(0);
  });
});

describe('Върнато плащане', () => {
  it('отнема кредитите и връща водния знак', async () => {
    const userId = await makeUser();
    await handleStripeEvent(paidSession(userId, 50));

    expect(await hasEverPurchased(userId)).toBe(true);

    const chargeId = `ch_${crypto.randomUUID()}`;
    expect(await handleStripeEvent(refundedCharge(userId, 50, { chargeId }))).toBe(
      'REVOKED',
    );

    expect(await getBalance(userId)).toBe(0);
    expect(await getLedgerSum(userId)).toBe(0);
    // Купил и си върнал парите не значи „купувал е".
    expect(await hasEverPurchased(userId)).toBe(false);
  });

  it('балансът не пада под нула, ако кредитите вече са изхарчени', async () => {
    const userId = await makeUser();
    await handleStripeEvent(paidSession(userId, 25));

    // Човекът харчи 20 от 25 и после иска парите обратно.
    await system.user.update({ where: { id: userId }, data: { credits: 5 } });
    await system.creditLedger.create({
      data: { userId, delta: -20, reason: 'ADMIN', balance: 5 },
    });

    await handleStripeEvent(refundedCharge(userId, 25));

    // Отнемаме колкото има. Разликата е наша загуба, не отрицателен баланс.
    expect(await getBalance(userId)).toBe(0);
    expect(await getLedgerSum(userId)).toBe(0);
  });

  it('частично връщане отнема пропорционален брой кредити', async () => {
    const userId = await makeUser();
    await handleStripeEvent(paidSession(userId, 100));

    // Върната е половината сума: 100 кредита × €0.20 = 2000 цента.
    await handleStripeEvent(refundedCharge(userId, 100, { amount: 2000, refunded: 1000 }));

    expect(await getBalance(userId)).toBe(50);
    expect(await getLedgerSum(userId)).toBe(50);
  });
});
