/**
 * БЕЗПЛАТНИ КРЕДИТИ — раздаване и гейтване по риск.
 *
 * Числата идват от средата: 3 при регистрация, +1 за имейл, +1 за телефон,
 * праг за SMS 40, праг за блокиране 70.
 */

import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { dbSystem, disconnectAll } from '@probvai/db';
import { env } from '../src/env';
import { reconcileFreeCredits } from '../src/free-credits';
import { getBalance } from '../src/credits';
import { hashEmail } from '../src/hash';

const system = dbSystem();
const createdUsers: string[] = [];
const createdIdentities: string[] = [];

const MAX_FREE =
  env.FREE_CREDITS_SIGNUP +
  env.FREE_CREDITS_EMAIL_VERIFIED +
  env.FREE_CREDITS_PHONE_VERIFIED;

type UserOptions = {
  riskScore?: number;
  emailVerified?: boolean;
  phoneVerified?: boolean;
};

async function makeUser(options: UserOptions = {}): Promise<{ id: string; email: string }> {
  const email = `free-${crypto.randomUUID()}@example.test`;
  const now = new Date();

  const user = await system.user.create({
    data: {
      email,
      riskScore: options.riskScore ?? 0,
      emailVerified: options.emailVerified ? now : null,
      phoneVerifiedAt: options.phoneVerified ? now : null,
      ...(options.phoneVerified ? { phone: `+3598${Date.now() % 100000000}` } : {}),
    },
    select: { id: true },
  });

  createdUsers.push(user.id);
  return { id: user.id, email };
}

afterEach(async () => {
  if (createdUsers.length > 0) {
    await system.user.deleteMany({ where: { id: { in: createdUsers } } });
    createdUsers.length = 0;
  }
  if (createdIdentities.length > 0) {
    await system.deletedIdentity.deleteMany({
      where: { emailHash: { in: createdIdentities } },
    });
    createdIdentities.length = 0;
  }
});

afterAll(async () => {
  await disconnectAll();
});

describe('Нисък риск — получава всичко', () => {
  it('нов потребител получава кредитите за регистрация', async () => {
    const user = await makeUser();

    const result = await reconcileFreeCredits(user.id);

    expect(result.outcome).toBe('GRANTED');
    expect(result.granted).toBe(env.FREE_CREDITS_SIGNUP);
    expect(await getBalance(user.id)).toBe(env.FREE_CREDITS_SIGNUP);
  });

  it('второ извикване не начислява втори път', async () => {
    const user = await makeUser();

    await reconcileFreeCredits(user.id);
    const second = await reconcileFreeCredits(user.id);

    expect(second.granted).toBe(0);
    expect(second.outcome).toBe('NOTHING_DUE');
    expect(await getBalance(user.id)).toBe(env.FREE_CREDITS_SIGNUP);
  });

  it('десет паралелни извиквания начисляват точно веднъж', async () => {
    const user = await makeUser();

    await Promise.all(Array.from({ length: 10 }, () => reconcileFreeCredits(user.id)));

    expect(await getBalance(user.id)).toBe(env.FREE_CREDITS_SIGNUP);
    const rows = await system.creditLedger.count({
      where: { userId: user.id, reason: 'SIGNUP' },
    });
    expect(rows).toBe(1);
  });

  it('потвърденият имейл добавя бонуса', async () => {
    const user = await makeUser();
    await reconcileFreeCredits(user.id);

    await system.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    });
    const after = await reconcileFreeCredits(user.id);

    expect(after.granted).toBe(env.FREE_CREDITS_EMAIL_VERIFIED);
    expect(await getBalance(user.id)).toBe(
      env.FREE_CREDITS_SIGNUP + env.FREE_CREDITS_EMAIL_VERIFIED,
    );
  });

  it('имейл и телефон заедно дават максимума от 5', async () => {
    const user = await makeUser({ emailVerified: true, phoneVerified: true });

    await reconcileFreeCredits(user.id);

    expect(await getBalance(user.id)).toBe(MAX_FREE);
    expect(MAX_FREE).toBe(5);
  });
});

describe('Среден риск — кредитите чакат SMS', () => {
  it('при риск на прага за SMS не се начислява нищо', async () => {
    const user = await makeUser({ riskScore: env.RISK_THRESHOLD_SMS, emailVerified: true });

    const result = await reconcileFreeCredits(user.id);

    expect(result.outcome).toBe('PENDING_PHONE');
    expect(await getBalance(user.id)).toBe(0);

    // Флагът остава вдигнат надолу, за да може да получи кредитите по-късно.
    const fresh = await system.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fresh.freeCreditsGiven).toBe(false);
  });

  it('след потвърден телефон получава пълните 5', async () => {
    const user = await makeUser({ riskScore: env.RISK_THRESHOLD_SMS, emailVerified: true });
    await reconcileFreeCredits(user.id);
    expect(await getBalance(user.id)).toBe(0);

    await system.user.update({
      where: { id: user.id },
      data: { phoneVerifiedAt: new Date(), phone: `+3598${Date.now() % 100000000}` },
    });
    const after = await reconcileFreeCredits(user.id);

    expect(after.outcome).toBe('GRANTED');
    expect(await getBalance(user.id)).toBe(MAX_FREE);
  });
});

describe('Висок риск — нула, без обяснение', () => {
  it('при риск на прага за блокиране не се начислява нищо', async () => {
    const user = await makeUser({
      riskScore: env.RISK_THRESHOLD_BLOCK,
      emailVerified: true,
      phoneVerified: true,
    });

    const result = await reconcileFreeCredits(user.id);

    expect(result.outcome).toBe('BLOCKED_HIGH_RISK');
    expect(result.granted).toBe(0);
    expect(await getBalance(user.id)).toBe(0);
  });
});

describe('Повторна регистрация след изтрит профил', () => {
  it('не получава безплатни кредити', async () => {
    const user = await makeUser({ emailVerified: true, phoneVerified: true });

    const emailHash = hashEmail(user.email);
    await system.deletedIdentity.create({ data: { emailHash } });
    createdIdentities.push(emailHash);

    const result = await reconcileFreeCredits(user.id);

    expect(result.outcome).toBe('RETURNING_DELETED');
    expect(await getBalance(user.id)).toBe(0);
  });

  it('вдига рисковата оценка, за да е видимо в админ панела', async () => {
    const user = await makeUser();
    const emailHash = hashEmail(user.email);
    await system.deletedIdentity.create({ data: { emailHash } });
    createdIdentities.push(emailHash);

    await reconcileFreeCredits(user.id);

    const fresh = await system.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fresh.riskScore).toBeGreaterThanOrEqual(env.RISK_THRESHOLD_BLOCK);
  });

  it('проверката е по хеш — сравнението не пази имейла в чист вид', async () => {
    const user = await makeUser();
    const emailHash = hashEmail(user.email);

    await system.deletedIdentity.create({ data: { emailHash } });
    createdIdentities.push(emailHash);

    const stored = await system.deletedIdentity.findUniqueOrThrow({ where: { emailHash } });
    expect(stored.emailHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.emailHash).not.toContain('@');
  });
});
