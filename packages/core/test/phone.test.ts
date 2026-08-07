/**
 * ПОТВЪРЖДАВАНЕ НА ТЕЛЕФОН
 *
 * Кодът се пази само като хеш, затова в тестовете за успешния път сами
 * записваме реда с известен хеш. Точно това е и целта на схемата: дори
 * пълен достъп до таблицата не показва кода.
 */

import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { dbSystem, disconnectAll } from '@probvai/db';
import { env } from '../src/env';
import { getBalance } from '../src/credits';
import { normalizePhone, sha256Hex } from '../src/hash';
import { startPhoneVerification, verifyPhoneCode } from '../src/phone';

const system = dbSystem();
const createdUsers: string[] = [];

let phoneCounter = 0;
function uniquePhone(): string {
  phoneCounter += 1;
  return `+35988${String(Date.now() % 100000).padStart(5, '0')}${phoneCounter}`;
}

async function makeUser(): Promise<string> {
  const user = await system.user.create({
    data: { email: `phone-${crypto.randomUUID()}@example.test` },
    select: { id: true },
  });
  createdUsers.push(user.id);
  return user.id;
}

/** Записва чакащ код с известна стойност. */
async function seedCode(
  userId: string,
  code: string,
  overrides: { phone?: string; expiresAt?: Date; attempts?: number } = {},
): Promise<string> {
  const phone = overrides.phone ?? uniquePhone();
  await system.phoneVerification.create({
    data: {
      userId,
      phone,
      codeHash: sha256Hex(code),
      attempts: overrides.attempts ?? 0,
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  return phone;
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

describe('Нормализиране на номера', () => {
  it('приема българските начини на записване', () => {
    expect(normalizePhone('0888123456')).toBe('+359888123456');
    expect(normalizePhone('+359 888 123 456')).toBe('+359888123456');
    expect(normalizePhone('00359888123456')).toBe('+359888123456');
    expect(normalizePhone('359888123456')).toBe('+359888123456');
  });
});

describe('Пращане на код', () => {
  it('отказва безсмислен номер', async () => {
    const userId = await makeUser();
    const result = await startPhoneVerification(userId, '123');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('INVALID_PHONE');
  });

  it('отказва номер, зает от друг потвърден профил', async () => {
    const owner = await makeUser();
    const phone = uniquePhone();
    await system.user.update({
      where: { id: owner },
      data: { phone, phoneVerifiedAt: new Date() },
    });

    const newcomer = await makeUser();
    const result = await startPhoneVerification(newcomer, phone);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('PHONE_IN_USE');
  });

  it('втори SMS веднага след първия се отказва', async () => {
    const userId = await makeUser();
    const phone = uniquePhone();

    const first = await startPhoneVerification(userId, phone);
    expect(first.ok).toBe(true);

    const second = await startPhoneVerification(userId, phone);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe('COOLDOWN');
  });

  it('не праща повече от дневния таван', async () => {
    const userId = await makeUser();
    const phone = uniquePhone();

    // Изчерпваме тавана със стари записи, за да не удрят в изчакването.
    const old = new Date(Date.now() - 60 * 60 * 1000);
    for (let i = 0; i < env.PHONE_MAX_SENDS_PER_DAY; i += 1) {
      await system.phoneVerification.create({
        data: {
          userId,
          phone,
          codeHash: sha256Hex(String(i)),
          expiresAt: old,
          createdAt: old,
        },
      });
    }

    const result = await startPhoneVerification(userId, phone);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('DAILY_LIMIT');
  });
});

describe('Проверка на кода', () => {
  it('верният код потвърждава телефона и начислява кредит', async () => {
    const userId = await makeUser();
    const phone = await seedCode(userId, '123456');

    const result = await verifyPhoneCode(userId, '123456');

    expect(result.ok).toBe(true);
    const user = await system.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.phone).toBe(phone);
    expect(user.phoneVerifiedAt).not.toBeNull();

    // Регистрация + телефон, без имейл.
    expect(await getBalance(userId)).toBe(
      env.FREE_CREDITS_SIGNUP + env.FREE_CREDITS_PHONE_VERIFIED,
    );
  });

  it('грешният код брои опит и не потвърждава', async () => {
    const userId = await makeUser();
    await seedCode(userId, '123456');

    const result = await verifyPhoneCode(userId, '000000');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('WRONG_CODE');

    const row = await system.phoneVerification.findFirstOrThrow({ where: { userId } });
    expect(row.attempts).toBe(1);

    const user = await system.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.phoneVerifiedAt).toBeNull();
  });

  it('след изчерпани опити кодът не работи дори верен', async () => {
    const userId = await makeUser();
    await seedCode(userId, '123456', { attempts: env.PHONE_MAX_ATTEMPTS });

    const result = await verifyPhoneCode(userId, '123456');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('TOO_MANY_ATTEMPTS');
  });

  it('изтекъл код не работи', async () => {
    const userId = await makeUser();
    await seedCode(userId, '123456', { expiresAt: new Date(Date.now() - 1000) });

    const result = await verifyPhoneCode(userId, '123456');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('EXPIRED');
  });

  it('един код не може да се използва два пъти', async () => {
    const userId = await makeUser();
    await seedCode(userId, '123456');

    await verifyPhoneCode(userId, '123456');
    const second = await verifyPhoneCode(userId, '123456');

    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe('NO_PENDING_CODE');
  });

  it('в базата се пази хеш, не самият код', async () => {
    const userId = await makeUser();
    await seedCode(userId, '654321');

    const row = await system.phoneVerification.findFirstOrThrow({ where: { userId } });
    expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.codeHash).not.toContain('654321');
  });
});
