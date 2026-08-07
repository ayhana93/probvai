/**
 * ПОТВЪРЖДАВАНЕ НА ТЕЛЕФОН
 *
 * Шестцифрен код по SMS. В базата се пази само SHA-256 хеш на кода —
 * ако някой прочете таблицата, не може да влезе с прочетеното.
 *
 * Защитите не са по избор:
 *   • кодът се генерира с `randomInt` от node:crypto, не с `Math.random`
 *   • сравнението е с `timingSafeEqual` — иначе времето за отговор издава
 *     колко символа съвпадат
 *   • брой опити, срок на валидност, изчакване между два SMS-а и таван
 *     на SMS-ите за денонощие — всичко през средата
 *
 * Ако телефонът вече е потвърден от друг акаунт, отказваме. Във Фаза 6
 * същият сигнал носи +60 точки риск.
 */

import { randomInt, timingSafeEqual } from 'node:crypto';
import { dbSystem } from '@probvai/db';
import { env } from './env';
import { reconcileFreeCredits, type FreeCreditResult } from './free-credits';
import { isPlausiblePhone, normalizePhone, sha256Hex } from './hash';
import { sendSms } from './sms';

export type PhoneStartFailure =
  | 'INVALID_PHONE'
  | 'PHONE_IN_USE'
  | 'ALREADY_VERIFIED'
  | 'COOLDOWN'
  | 'DAILY_LIMIT'
  | 'SMS_FAILED'
  | 'USER_NOT_FOUND';

export type PhoneStartResult =
  | { ok: true; phone: string; expiresAt: Date }
  | { ok: false; reason: PhoneStartFailure };

export type VerifyFailure =
  | 'NO_PENDING_CODE'
  | 'EXPIRED'
  | 'TOO_MANY_ATTEMPTS'
  | 'WRONG_CODE'
  | 'PHONE_IN_USE'
  | 'USER_NOT_FOUND';

export type VerifyResult =
  | { ok: true; credits: FreeCreditResult }
  | { ok: false; reason: VerifyFailure };

function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Сравнява два хеша в постоянно време. */
function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

// ---------------------------------------------------------------------------

/** Праща код за потвърждаване на телефон. */
export async function startPhoneVerification(
  userId: string,
  rawPhone: string,
): Promise<PhoneStartResult> {
  const system = dbSystem();

  const phone = normalizePhone(rawPhone);
  if (!isPlausiblePhone(phone)) {
    return { ok: false, reason: 'INVALID_PHONE' };
  }

  const user = await system.user.findUnique({
    where: { id: userId },
    select: { id: true, phoneVerifiedAt: true },
  });
  if (!user) return { ok: false, reason: 'USER_NOT_FOUND' };
  if (user.phoneVerifiedAt) return { ok: false, reason: 'ALREADY_VERIFIED' };

  // Един телефон — един акаунт.
  const taken = await system.user.findFirst({
    where: { phone, phoneVerifiedAt: { not: null }, NOT: { id: userId } },
    select: { id: true },
  });
  if (taken) return { ok: false, reason: 'PHONE_IN_USE' };

  const now = new Date();

  const last = await system.phoneVerification.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (last) {
    const secondsSince = (now.getTime() - last.createdAt.getTime()) / 1000;
    if (secondsSince < env.PHONE_RESEND_COOLDOWN_SECONDS) {
      return { ok: false, reason: 'COOLDOWN' };
    }
  }

  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sentToday = await system.phoneVerification.count({
    where: { userId, createdAt: { gte: dayAgo } },
  });
  if (sentToday >= env.PHONE_MAX_SENDS_PER_DAY) {
    return { ok: false, reason: 'DAILY_LIMIT' };
  }

  const code = generateCode();
  const expiresAt = new Date(now.getTime() + env.PHONE_CODE_TTL_SECONDS * 1000);

  await system.phoneVerification.create({
    data: { userId, phone, codeHash: sha256Hex(code), expiresAt },
  });

  const minutes = Math.round(env.PHONE_CODE_TTL_SECONDS / 60);
  const sms = await sendSms(
    phone,
    `Кодът ти за ПРОБВАЙ е ${code}. Валиден е ${minutes} минути.`,
  );

  if (!sms.ok) {
    return { ok: false, reason: 'SMS_FAILED' };
  }

  return { ok: true, phone, expiresAt };
}

// ---------------------------------------------------------------------------

/** Проверява кода и при успех потвърждава телефона и начислява кредита. */
export async function verifyPhoneCode(
  userId: string,
  code: string,
): Promise<VerifyResult> {
  const system = dbSystem();
  const now = new Date();

  const user = await system.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) return { ok: false, reason: 'USER_NOT_FOUND' };

  const pending = await system.phoneVerification.findFirst({
    where: { userId, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!pending) return { ok: false, reason: 'NO_PENDING_CODE' };
  if (pending.expiresAt <= now) return { ok: false, reason: 'EXPIRED' };
  if (pending.attempts >= env.PHONE_MAX_ATTEMPTS) {
    return { ok: false, reason: 'TOO_MANY_ATTEMPTS' };
  }

  const submitted = sha256Hex(code.trim());
  if (!hashesMatch(submitted, pending.codeHash)) {
    await system.phoneVerification.update({
      where: { id: pending.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: 'WRONG_CODE' };
  }

  // Между пращането и потвърждаването някой друг може да е заел номера.
  const taken = await system.user.findFirst({
    where: { phone: pending.phone, phoneVerifiedAt: { not: null }, NOT: { id: userId } },
    select: { id: true },
  });
  if (taken) return { ok: false, reason: 'PHONE_IN_USE' };

  await system.$transaction([
    system.phoneVerification.update({
      where: { id: pending.id },
      data: { consumedAt: now },
    }),
    system.user.update({
      where: { id: userId },
      data: { phone: pending.phone, phoneVerifiedAt: now, lastActiveAt: now },
    }),
  ]);

  // Потвърденият телефон отключва и чакащите кредити при среден риск.
  const credits = await reconcileFreeCredits(userId);

  return { ok: true, credits };
}
