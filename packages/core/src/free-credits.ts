/**
 * БЕЗПЛАТНИ КРЕДИТИ
 *
 * Максимумът е 3 + 1 + 1 = 5:
 *   3 при регистрация · +1 при потвърден имейл · +1 при потвърден телефон
 *
 * Рискът гейтва, не намалява:
 *   0–39   получава всичко веднага, щом изпълни условието
 *   40–69  не получава нищо, докато не потвърди телефон със SMS;
 *          след това получава пълните 5
 *   70+    нула. И НИКОГА не разбира защо — просто вижда екрана за
 *          зареждане на кредити.
 *
 * Повторна регистрация след изтриване на профил също дава нула. Проверката
 * е по SHA-256 хеш на имейла в `deleted_identities` — необратимо и
 * GDPR-съвместимо.
 *
 * ═══ ЗАЩО ЕДНА ФУНКЦИЯ, А НЕ ТРИ ═══
 *
 * `reconcileFreeCredits` пресмята на какво има право потребителката СЕГА и
 * начислява само липсващото. Викаме я след регистрация, след потвърден имейл
 * и след потвърден телефон — и трите пъти една и съща функция. Няма как един
 * път да сметне едно, а друг път друго.
 *
 * Двойно начисляване е невъзможно: частичният уникален индекс
 * `credit_ledger_one_time_grants` пуска най-много един ред от вид
 * SIGNUP / EMAIL_VERIFY / PHONE_VERIFY на потребител.
 */

import { dbSystem, type LedgerReason } from '@probvai/db';
import { addCredits, getBalance } from './credits';
import { env } from './env';
import { hashEmail } from './hash';

/**
 * Колко точки носи повторна регистрация след изтрит профил.
 * Стойността е над всеки праг — такъв акаунт не получава нищо.
 * Във Фаза 6 влиза в общата таблица със сигналите.
 */
export const RISK_POINTS_RETURNING_DELETED = 100;

export type FreeCreditOutcome =
  /** Начислени са кредити. */
  | 'GRANTED'
  /** Нямаше какво да се начисли — вече е получено. */
  | 'NOTHING_DUE'
  /** Рискът е над прага за SMS. Кредитите чакат потвърден телефон. */
  | 'PENDING_PHONE'
  /** Рискът е над прага за блокиране. Нула кредита, без съобщение. */
  | 'BLOCKED_HIGH_RISK'
  /** Имейлът вече е бил регистриран и изтрит. Нула кредита. */
  | 'RETURNING_DELETED'
  | 'USER_NOT_FOUND';

export type FreeCreditResult = {
  outcome: FreeCreditOutcome;
  granted: number;
  balance: number;
};

/**
 * Начислява всички безплатни кредити, на които потребителката има право в
 * този момент, и пропуска вече начислените.
 *
 * Безопасна е за многократно извикване.
 */
export async function reconcileFreeCredits(userId: string): Promise<FreeCreditResult> {
  const system = dbSystem();

  const user = await system.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      phoneVerifiedAt: true,
      riskScore: true,
      freeCreditsGiven: true,
    },
  });

  if (!user) {
    return { outcome: 'USER_NOT_FOUND', granted: 0, balance: 0 };
  }

  // ── 1. Връща ли се някой, който вече си е изтрил профила? ────────────────
  const returning = await system.deletedIdentity.findUnique({
    where: { emailHash: hashEmail(user.email) },
    select: { id: true },
  });

  let risk = user.riskScore;

  if (returning && risk < RISK_POINTS_RETURNING_DELETED) {
    risk = RISK_POINTS_RETURNING_DELETED;
    await system.user.update({
      where: { id: userId },
      data: { riskScore: risk, freeCreditsGiven: true },
    });
  }

  if (returning) {
    return { outcome: 'RETURNING_DELETED', granted: 0, balance: await getBalance(userId) };
  }

  // ── 2. Прагове на риска ──────────────────────────────────────────────────
  if (risk >= env.RISK_THRESHOLD_BLOCK) {
    if (!user.freeCreditsGiven) {
      await system.user.update({
        where: { id: userId },
        data: { freeCreditsGiven: true },
      });
    }
    return { outcome: 'BLOCKED_HIGH_RISK', granted: 0, balance: await getBalance(userId) };
  }

  if (risk >= env.RISK_THRESHOLD_SMS && !user.phoneVerifiedAt) {
    // Нищо не се начислява и флагът НЕ се вдига — кредитите чакат SMS.
    return { outcome: 'PENDING_PHONE', granted: 0, balance: await getBalance(userId) };
  }

  // ── 3. На какво има право сега ───────────────────────────────────────────
  const due: { reason: LedgerReason; amount: number }[] = [
    { reason: 'SIGNUP', amount: env.FREE_CREDITS_SIGNUP },
  ];

  if (user.emailVerified) {
    due.push({ reason: 'EMAIL_VERIFY', amount: env.FREE_CREDITS_EMAIL_VERIFIED });
  }
  if (user.phoneVerifiedAt) {
    due.push({ reason: 'PHONE_VERIFY', amount: env.FREE_CREDITS_PHONE_VERIFIED });
  }

  let granted = 0;
  let balance = await getBalance(userId);

  for (const { reason, amount } of due) {
    if (amount <= 0) continue;

    const result = await addCredits(userId, amount, reason);
    if (result.ok) {
      granted += amount;
      balance = result.balance;
    } else {
      // ALREADY_GRANTED е нормалното състояние при повторно извикване.
      balance = result.balance;
    }
  }

  if (!user.freeCreditsGiven) {
    await system.user.update({
      where: { id: userId },
      data: { freeCreditsGiven: true },
    });
  }

  return {
    outcome: granted > 0 ? 'GRANTED' : 'NOTHING_DUE',
    granted,
    balance,
  };
}

/** Извиква се от Auth.js веднага след създаването на потребител. */
export const grantSignupCredits = reconcileFreeCredits;

/** Извиква се след потвърждаване на имейл. */
export const grantEmailVerifiedCredits = reconcileFreeCredits;

/** Извиква се след успешно потвърждаване на телефон. */
export const grantPhoneVerifiedCredits = reconcileFreeCredits;
