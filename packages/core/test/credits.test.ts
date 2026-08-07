/**
 * КРЕДИТИ — задължителните тестове от заданието.
 *
 * Тестът за едновременно харчене е гейт за цялата фаза. Ако той не минава,
 * не продължаваме: значи харчим кредити, които никой не ни е платил, и няма
 * как да проследим откъде изтича.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dbSystem, disconnectAll } from '@probvai/db';
import {
  addCredits,
  getBalance,
  getLedgerSum,
  refundCredit,
  spendCredit,
} from '../src/credits';

const system = dbSystem();
const createdUsers: string[] = [];

async function makeUser(credits: number): Promise<string> {
  const user = await system.user.create({
    data: {
      email: `credits-${crypto.randomUUID()}@example.test`,
      credits,
    },
    select: { id: true },
  });

  if (credits > 0) {
    // Началният баланс също минава през леджера, за да е вярна проверката
    // SUM(delta) === users.credits.
    await system.creditLedger.create({
      data: { userId: user.id, delta: credits, reason: 'ADMIN', balance: credits },
    });
  }

  createdUsers.push(user.id);
  return user.id;
}

afterEach(async () => {
  if (createdUsers.length > 0) {
    await system.user.deleteMany({ where: { id: { in: createdUsers } } });
    createdUsers.length = 0;
  }
});

afterAll(async () => {
  await disconnectAll();
});

// ---------------------------------------------------------------------------

describe('Едновременно харчене — гейтът на Фаза 1', () => {
  it('10 паралелни заявки при баланс 5 → точно 5 успешни, 5 отказани, краен баланс 0', async () => {
    const userId = await makeUser(5);

    // Десет различни генерации, пуснати наистина едновременно.
    const generationIds = Array.from({ length: 10 }, () => crypto.randomUUID());
    const results = await Promise.all(
      generationIds.map((generationId) => spendCredit(userId, generationId)),
    );

    const succeeded = results.filter((r) => r.ok);
    const refused = results.filter((r) => !r.ok);

    expect(succeeded).toHaveLength(5);
    expect(refused).toHaveLength(5);

    // Всички откази трябва да са по една и съща причина — липса на кредити,
    // а не например изтекла транзакция.
    for (const result of refused) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('INSUFFICIENT_CREDITS');
    }

    expect(await getBalance(userId)).toBe(0);
    expect(await getLedgerSum(userId)).toBe(0);

    // Точно пет реда за харчене, нито един повече.
    const spends = await system.creditLedger.count({
      where: { userId, reason: 'GENERATION' },
    });
    expect(spends).toBe(5);

    // Всеки ред записва баланса СЛЕД операцията. Подредени по време,
    // те трябва да слизат 4, 3, 2, 1, 0.
    const ledger = await system.creditLedger.findMany({
      where: { userId, reason: 'GENERATION' },
      orderBy: { balance: 'desc' },
      select: { balance: true },
    });
    expect(ledger.map((row) => row.balance)).toEqual([4, 3, 2, 1, 0]);
  });

  it('20 паралелни заявки при баланс 0 → нито една не минава', async () => {
    const userId = await makeUser(0);

    const results = await Promise.all(
      Array.from({ length: 20 }, () => spendCredit(userId, crypto.randomUUID())),
    );

    expect(results.filter((r) => r.ok)).toHaveLength(0);
    expect(await getBalance(userId)).toBe(0);
  });

  it('едно и също harчене два пъти удържа само веднъж', async () => {
    const userId = await makeUser(3);
    const generationId = crypto.randomUUID();

    const first = await spendCredit(userId, generationId);
    const second = await spendCredit(userId, generationId);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe('ALREADY_SPENT');
    expect(await getBalance(userId)).toBe(2);
  });
});

// ---------------------------------------------------------------------------

describe('Връщане на кредит', () => {
  it('връща баланса коректно', async () => {
    const userId = await makeUser(2);
    const generationId = crypto.randomUUID();

    await spendCredit(userId, generationId);
    expect(await getBalance(userId)).toBe(1);

    const refund = await refundCredit(userId, generationId);
    expect(refund.ok).toBe(true);
    if (refund.ok) expect(refund.balance).toBe(2);

    expect(await getBalance(userId)).toBe(2);
    expect(await getLedgerSum(userId)).toBe(2);
  });

  it('второ връщане за същата генерация не дава втори кредит', async () => {
    const userId = await makeUser(1);
    const generationId = crypto.randomUUID();

    await spendCredit(userId, generationId);
    await refundCredit(userId, generationId);
    const again = await refundCredit(userId, generationId);

    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toBe('ALREADY_REFUNDED');
    expect(await getBalance(userId)).toBe(1);
  });

  it('не връща кредит за генерация, за която не е харчен', async () => {
    const userId = await makeUser(1);

    const result = await refundCredit(userId, crypto.randomUUID());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('NOTHING_TO_REFUND');
    expect(await getBalance(userId)).toBe(1);
  });

  it('паралелни връщания за една генерация дават точно един кредит', async () => {
    const userId = await makeUser(1);
    const generationId = crypto.randomUUID();
    await spendCredit(userId, generationId);

    const results = await Promise.all(
      Array.from({ length: 5 }, () => refundCredit(userId, generationId)),
    );

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await getBalance(userId)).toBe(1);
  });
});

// ---------------------------------------------------------------------------

describe('Начисляване', () => {
  it('добавя кредити и записва баланса след операцията', async () => {
    const userId = await makeUser(0);

    const result = await addCredits(userId, 25, 'PURCHASE', 'cs_test_123');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.balance).toBe(25);
    expect(await getBalance(userId)).toBe(25);
  });

  it('едно и също плащане два пъти начислява веднъж', async () => {
    const userId = await makeUser(0);

    await addCredits(userId, 25, 'PURCHASE', 'cs_test_456');
    const second = await addCredits(userId, 25, 'PURCHASE', 'cs_test_456');

    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe('ALREADY_GRANTED');
    expect(await getBalance(userId)).toBe(25);
  });

  it('отказва отрицателни и дробни количества', async () => {
    const userId = await makeUser(10);

    for (const amount of [0, -5, 2.5, Number.NaN]) {
      const result = await addCredits(userId, amount, 'ADMIN');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('INVALID_AMOUNT');
    }

    expect(await getBalance(userId)).toBe(10);
  });

  it('спрян потребител не може да харчи', async () => {
    const userId = await makeUser(5);
    await system.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });

    const result = await spendCredit(userId, crypto.randomUUID());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('USER_SUSPENDED');
    expect(await getBalance(userId)).toBe(5);
  });
});

// ---------------------------------------------------------------------------

describe('Съгласуваност: SUM(ledger.delta) === users.credits', () => {
  it('важи за всеки потребител след разбъркана поредица от операции', async () => {
    const users = await Promise.all([makeUser(0), makeUser(3), makeUser(10)]);

    const operations: Promise<unknown>[] = [];
    for (const userId of users) {
      operations.push(addCredits(userId, 25, 'PURCHASE', `cs_${crypto.randomUUID()}`));
      for (let i = 0; i < 6; i += 1) {
        const generationId = crypto.randomUUID();
        operations.push(
          spendCredit(userId, generationId).then((r) =>
            r.ok && i % 2 === 0 ? refundCredit(userId, generationId) : null,
          ),
        );
      }
    }
    await Promise.all(operations);

    // Проверката минава през ВСИЧКИ потребители в базата, не само нашите.
    const rows = await system.$queryRaw<
      { id: string; credits: number; ledger_sum: number }[]
    >`
      SELECT u.id,
             u.credits,
             COALESCE(SUM(l.delta), 0)::int AS ledger_sum
      FROM users u
      LEFT JOIN credit_ledger l ON l.user_id = u.id
      GROUP BY u.id, u.credits
      HAVING u.credits <> COALESCE(SUM(l.delta), 0)::int
    `;

    expect(rows).toEqual([]);
  });
});
