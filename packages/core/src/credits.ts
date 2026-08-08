/**
 * КРЕДИТИ — единственият път до баланса.
 *
 * Правило №4 от заданието: никъде другаде в кода не се пише
 * `UPDATE users SET credits = ...`. Базата го налага и на ниво права —
 * ролята `app_user` физически няма UPDATE върху колоната `credits`.
 * Затова всичко тук минава през `app_system`.
 *
 * ═══ ЗАЩО ВСЯКА ФУНКЦИЯ ЗАПОЧВА СЪС `SELECT ... FOR UPDATE` ═══
 *
 * Без заключване на реда две едновременни заявки четат баланс 1, двете
 * виждат „има кредит", двете харчат. Плащаме за две генерации срещу един
 * кредит и няма как да проследим откъде изтича.
 *
 * `FOR UPDATE` кара втората заявка да ЧАКА първата. При READ COMMITTED,
 * след като първата приключи, втората прочита новата стойност — не старата,
 * която е видяла преди да зачака. Точно това прави сметката вярна.
 *
 * ═══ ВТОРИЯТ ПОЯС ═══
 *
 * Освен заключването, миграцията слага два частични уникални индекса:
 *   • един подарък от вид SIGNUP / EMAIL_VERIFY / PHONE_VERIFY на потребител
 *   • едно харчене, едно връщане и едно плащане на `ref_id`
 * Проверка и запис са две действия и между тях може да се промъкне заявка.
 * През уникален индекс не се промъква нищо.
 */

import { dbSystem, Prisma, type LedgerReason } from '@probvai/db';

/** Защо една операция с кредити е била отказана. */
export type CreditFailure =
  | 'INSUFFICIENT_CREDITS'
  | 'USER_NOT_FOUND'
  | 'USER_SUSPENDED'
  | 'ALREADY_SPENT'
  | 'ALREADY_REFUNDED'
  | 'ALREADY_GRANTED'
  | 'NOTHING_TO_REFUND'
  | 'INVALID_AMOUNT';

export type CreditResult =
  | { ok: true; balance: number; ledgerId: string }
  | { ok: false; reason: CreditFailure; balance: number };

type LockedUser = { credits: number; status: string };

/**
 * READ COMMITTED е достатъчно — цялата коректност идва от `FOR UPDATE`,
 * не от нивото на изолация. По-строго ниво само би добавило откази
 * от вид „не мога да сериализирам", които после трябва да повтаряме.
 */
const TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  // Десет едновременни заявки чакат една друга на реда. Дай им време.
  timeout: 20_000,
  maxWait: 20_000,
} as const;

/**
 * Заключва реда на потребителя и връща текущото му състояние.
 * Всяка функция в този файл започва оттук.
 */
async function lockUser(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<LockedUser | null> {
  const rows = await tx.$queryRaw<LockedUser[]>`
    SELECT credits, status::text AS status
    FROM users
    WHERE id = ${userId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
  );
}

// ---------------------------------------------------------------------------
// Харчене
// ---------------------------------------------------------------------------

/**
 * Удържа един кредит за конкретна генерация.
 *
 * Извиква се ПРЕДИ обръщението към AI доставчика. Ако редът се обърне,
 * два отворени таба генерират две снимки срещу един кредит.
 *
 * Идемпотентна е по `generationId` — повторно извикване не удържа втори път.
 *
 * `onSpent` се изпълнява В СЪЩАТА транзакция, след като кредитът е удържан.
 * През него Фаза 2 създава реда в `generations`, както е описано в заданието:
 * леджерът, балансът и генерацията влизат заедно или не влизат изобщо.
 * Ако функцията хвърли, цялата транзакция се връща назад.
 */
export async function spendCredit(
  userId: string,
  generationId: string,
  onSpent?: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<CreditResult> {
  try {
    return await dbSystem().$transaction(async (tx) => {
      const user = await lockUser(tx, userId);
      if (!user) {
        return { ok: false, reason: 'USER_NOT_FOUND', balance: 0 };
      }
      if (user.status !== 'ACTIVE') {
        return { ok: false, reason: 'USER_SUSPENDED', balance: user.credits };
      }

      const already = await tx.creditLedger.findFirst({
        where: { reason: 'GENERATION', refId: generationId },
        select: { id: true },
      });
      if (already) {
        return { ok: false, reason: 'ALREADY_SPENT', balance: user.credits };
      }

      if (user.credits < 1) {
        return { ok: false, reason: 'INSUFFICIENT_CREDITS', balance: user.credits };
      }

      const balance = user.credits - 1;

      const entry = await tx.creditLedger.create({
        data: {
          userId,
          delta: -1,
          reason: 'GENERATION',
          refId: generationId,
          balance,
        },
        select: { id: true },
      });

      await tx.user.update({ where: { id: userId }, data: { credits: balance } });

      if (onSpent) {
        await onSpent(tx);
      }

      return { ok: true, balance, ledgerId: entry.id };
    }, TX_OPTIONS);
  } catch (error) {
    // Уникалният индекс е спрял второ харчене за същата генерация.
    if (isUniqueViolation(error)) {
      return { ok: false, reason: 'ALREADY_SPENT', balance: await getBalance(userId) };
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Начисляване
// ---------------------------------------------------------------------------

/**
 * Добавя кредити: покупка, безплатни при регистрация, ръчна корекция от админ.
 *
 * `refId` сочи към източника — Stripe session id, id на админа и така нататък.
 * За SIGNUP / EMAIL_VERIFY / PHONE_VERIFY и за PURCHASE с `refId` уникалният
 * индекс гарантира еднократност дори при повторно извикване.
 */
export async function addCredits(
  userId: string,
  amount: number,
  reason: LedgerReason,
  refId?: string,
): Promise<CreditResult> {
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, reason: 'INVALID_AMOUNT', balance: await getBalance(userId) };
  }

  try {
    return await dbSystem().$transaction(async (tx) => {
      const user = await lockUser(tx, userId);
      if (!user) {
        return { ok: false, reason: 'USER_NOT_FOUND', balance: 0 };
      }

      const balance = user.credits + amount;

      const entry = await tx.creditLedger.create({
        data: { userId, delta: amount, reason, refId: refId ?? null, balance },
        select: { id: true },
      });

      await tx.user.update({ where: { id: userId }, data: { credits: balance } });

      return { ok: true, balance, ledgerId: entry.id };
    }, TX_OPTIONS);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, reason: 'ALREADY_GRANTED', balance: await getBalance(userId) };
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Отнемане
// ---------------------------------------------------------------------------

/**
 * Отнема кредити при върнато плащане (chargeback, refund от Stripe).
 *
 * ═══ ЗАЩО БАЛАНСЪТ НЕ ПАДА ПОД НУЛА ═══
 *
 * Ако човек купи 50 кредита, изхарчи 40 и поиска парите си обратно, ние вече
 * сме платили на доставчика за 40 генерации. Отрицателният баланс не ги
 * връща — само прави следващия вход неизползваем и ражда билет в поддръжката.
 * Затова отнемаме колкото има; разликата е загуба и се вижда в леджера.
 *
 * Идемпотентна е по `refId` — второ webhook събитие за същото връщане не
 * отнема втори път.
 */
export async function revokeCredits(
  userId: string,
  amount: number,
  refId: string,
): Promise<CreditResult> {
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, reason: 'INVALID_AMOUNT', balance: await getBalance(userId) };
  }

  try {
    return await dbSystem().$transaction(async (tx) => {
      const user = await lockUser(tx, userId);
      if (!user) {
        return { ok: false, reason: 'USER_NOT_FOUND', balance: 0 };
      }

      const already = await tx.creditLedger.findFirst({
        where: { userId, reason: 'PURCHASE', refId },
        select: { id: true },
      });
      if (already) {
        return { ok: false, reason: 'ALREADY_REFUNDED', balance: user.credits };
      }

      const taken = Math.min(amount, user.credits);
      const balance = user.credits - taken;

      // Редът се пише дори когато `taken` е 0: одитната следа трябва да
      // показва, че връщането е дошло и че е нямало какво да се отнеме.
      const entry = await tx.creditLedger.create({
        data: { userId, delta: -taken, reason: 'PURCHASE', refId, balance },
        select: { id: true },
      });

      if (taken > 0) {
        await tx.user.update({ where: { id: userId }, data: { credits: balance } });
      }

      return { ok: true, balance, ledgerId: entry.id };
    }, TX_OPTIONS);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        reason: 'ALREADY_REFUNDED',
        balance: await getBalance(userId),
      };
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Връщане
// ---------------------------------------------------------------------------

/**
 * Връща кредита при провалена генерация.
 *
 * Идемпотентна е — повторно извикване за същата генерация не връща втори
 * кредит. Не пипа статуса на генерацията; това е работа на работника,
 * който знае защо е провалила.
 */
export async function refundCredit(
  userId: string,
  generationId: string,
): Promise<CreditResult> {
  try {
    return await dbSystem().$transaction(async (tx) => {
      const user = await lockUser(tx, userId);
      if (!user) {
        return { ok: false, reason: 'USER_NOT_FOUND', balance: 0 };
      }

      const spent = await tx.creditLedger.findFirst({
        where: { userId, reason: 'GENERATION', refId: generationId },
        select: { id: true },
      });
      if (!spent) {
        // Няма какво да върнем — кредит за тази генерация не е удържан.
        return { ok: false, reason: 'NOTHING_TO_REFUND', balance: user.credits };
      }

      const refunded = await tx.creditLedger.findFirst({
        where: { userId, reason: 'REFUND', refId: generationId },
        select: { id: true },
      });
      if (refunded) {
        return { ok: false, reason: 'ALREADY_REFUNDED', balance: user.credits };
      }

      const balance = user.credits + 1;

      const entry = await tx.creditLedger.create({
        data: { userId, delta: 1, reason: 'REFUND', refId: generationId, balance },
        select: { id: true },
      });

      await tx.user.update({ where: { id: userId }, data: { credits: balance } });

      return { ok: true, balance, ledgerId: entry.id };
    }, TX_OPTIONS);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        reason: 'ALREADY_REFUNDED',
        balance: await getBalance(userId),
      };
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Четене
// ---------------------------------------------------------------------------

/** Текущият баланс. Чете кеша в `users.credits`. */
export async function getBalance(userId: string): Promise<number> {
  const user = await dbSystem().user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });
  return user?.credits ?? 0;
}

/**
 * Истината според леджера: SUM(delta).
 *
 * `users.credits` е само кеш и трябва винаги да е равно на това число.
 * Ползва се от теста за съгласуваност и от админ панела.
 */
export async function getLedgerSum(userId: string): Promise<number> {
  const result = await dbSystem().creditLedger.aggregate({
    where: { userId },
    _sum: { delta: true },
  });
  return result._sum.delta ?? 0;
}
