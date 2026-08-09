/**
 * ЗАПОЧВАНЕ НА ГЕНЕРАЦИЯ
 *
 * ═══ РЕДЪТ НА СТЪПКИТЕ Е ЧАСТ ОТ ЗАДАНИЕТО И НЕ СЕ ПРОМЕНЯ ═══
 *
 *   1. сесия                                    (в route handler-а)
 *   2. изчакване между заявките
 *   3. ГЛОБАЛЕН ДНЕВЕН ТАВАН            ← аварийната спирачка
 *   4. дневен лимит на потребителя
 *   5. ТРАНЗАКЦИЯ:
 *        SELECT credits ... FOR UPDATE
 *        ако credits < 1 → отказ
 *        INSERT в credit_ledger (delta −1)
 *        UPDATE users SET credits
 *        INSERT в generations (QUEUED)
 *   6. задача в pg-boss
 *   7. връщаме generationId
 *
 * Кредитът се удържа ПРЕДИ да пипнем доставчика. Обърне ли се редът, два
 * отворени таба правят две снимки срещу един кредит.
 */

import { dbSystem, type GenSource, type Prisma } from '@probvai/db';
import { spendCredit } from './credits';
import { env } from './env';
import { personGenderFor } from './person';
import { checkAllBrakes, type BrakeReason } from './limits';
import { activeProvider } from './providers';
import { isAllowedAspectRatio, type AspectRatio } from './providers/types';
import { getBoss, QUEUES } from './queue';
import { keyBelongsTo } from './storage';

export type StartGenerationInput = {
  userId: string;
  personKey: string;
  garmentKey: string;
  aspectRatio: AspectRatio;
  /** Какво е поискал човекът с думи. По избор. */
  prompt?: string | null;
  /**
   * Качена снимка или линк от магазин. Заради това поле името на магазина
   * се показва в гардероба само когато го знаем наистина.
   */
  source?: GenSource;
  merchant?: string | null;
  productUrl?: string | null;
};

export type StartGenerationFailure =
  | BrakeReason
  | 'BAD_ASPECT_RATIO'
  | 'NOT_YOUR_FILE'
  | 'INSUFFICIENT_CREDITS'
  | 'USER_SUSPENDED'
  | 'USER_NOT_FOUND';

export type StartGenerationResult =
  | { ok: true; generationId: string; balance: number }
  | { ok: false; reason: StartGenerationFailure; retryAfterSeconds?: number };

export async function startGeneration(
  input: StartGenerationInput,
): Promise<StartGenerationResult> {
  const { userId, personKey, garmentKey } = input;

  // ── Проверки, които не струват нищо ──────────────────────────────────────

  // Съотношението се проверява срещу списъка на сървъра. Всичко извън него
  // е отказ БЕЗ харчене на кредит.
  if (!isAllowedAspectRatio(input.aspectRatio)) {
    return { ok: false, reason: 'BAD_ASPECT_RATIO' };
  }

  // Ключовете трябва да са на този потребител. Без тази проверка някой може
  // да подаде чужд ключ и да пробва дреха върху чужда снимка.
  if (!keyBelongsTo(personKey, userId) || !keyBelongsTo(garmentKey, userId)) {
    return { ok: false, reason: 'NOT_YOUR_FILE' };
  }

  if (env.MAINTENANCE_MODE) {
    return { ok: false, reason: 'MAINTENANCE' };
  }

  const provider = activeProvider();

  // ── Спирачките ───────────────────────────────────────────────────────────
  const brakes = await checkAllBrakes(userId, provider.costUSD);
  if (!brakes.allowed) {
    return {
      ok: false,
      reason: brakes.reason,
      ...(brakes.retryAfterSeconds === undefined
        ? {}
        : { retryAfterSeconds: brakes.retryAfterSeconds }),
    };
  }

  // ── Транзакцията ─────────────────────────────────────────────────────────
  // Id-то се знае предварително, за да сочи и редът в леджера, и редът в
  // generations към едно и също нещо в рамките на една транзакция.
  const generationId = crypto.randomUUID();

  const source: GenSource = input.source ?? 'UPLOAD';

  // Полът се чете ПРЕДИ транзакцията. Вътре в нея не се правят заявки,
  // които могат да чакат — редът на потребителя е заключен.
  const personGender = await personGenderFor(userId);

  const spend = await spendCredit(userId, generationId, async (tx: Prisma.TransactionClient) => {
    await tx.generation.create({
      data: {
        id: generationId,
        userId,
        status: 'QUEUED',
        provider: provider.name,
        personKey,
        garmentKey,
        aspectRatio: input.aspectRatio,
        prompt: input.prompt ?? null,
        source,
        personGender,
        // Име на магазин и адрес на продукт има само при линк. При качена
        // снимка не знаем от къде е дрехата и не се преструваме, че знаем.
        merchant: source === 'LINK' ? (input.merchant ?? null) : null,
        productUrl: source === 'LINK' ? (input.productUrl ?? null) : null,
        // Себестойността се ЗАПАЗВА още сега. Глобалният таван брои поети
        // задължения, не само платени сметки. При провал се нулира.
        costUSD: provider.costUSD,
      },
    });
  });

  if (!spend.ok) {
    switch (spend.reason) {
      case 'INSUFFICIENT_CREDITS':
        return { ok: false, reason: 'INSUFFICIENT_CREDITS' };
      case 'USER_SUSPENDED':
        return { ok: false, reason: 'USER_SUSPENDED' };
      case 'USER_NOT_FOUND':
        return { ok: false, reason: 'USER_NOT_FOUND' };
      default:
        return { ok: false, reason: 'INSUFFICIENT_CREDITS' };
    }
  }

  // ── Опашката ─────────────────────────────────────────────────────────────
  try {
    const boss = await getBoss();
    await boss.send(
      QUEUES.GENERATE,
      { generationId },
      {
        retryLimit: 1,
        retryDelay: 5,
        // Ако работникът умре, задачата се връща в опашката след толкова
        // секунди. Малко над таймаута на самата генерация.
        expireInSeconds: env.GENERATION_TIMEOUT_SECONDS + 60,
      },
    );
  } catch (error) {
    // Задачата не влезе в опашката. Кредитът е удържан — връщаме го веднага,
    // вместо да оставим потребителя да чака нещо, което няма да се случи.
    console.error('[generate] задачата не влезе в опашката:', error);
    await failGeneration(generationId, 'INTERNAL');
    return { ok: false, reason: 'INSUFFICIENT_CREDITS' };
  }

  return { ok: true, generationId, balance: spend.balance };
}

// ---------------------------------------------------------------------------

/**
 * Отбелязва генерация като провалена и връща кредита.
 *
 * ═══ РЕДЪТ ТУК СЪЩО ИМА ЗНАЧЕНИЕ ═══
 *
 * Първо се връща кредитът, чак после статусът става FAILED.
 *
 * Обратният ред изглежда по-естествен, но е по-лош по две причини. Ако
 * процесът умре между двете стъпки, потребителя остава с генерация
 * „провалена" и без върнат кредит — тоест губи пари заради наш срив. При
 * този ред най-лошото е генерация, заседнала в RUNNING с вече върнат кредит:
 * струва на нас, не на нея.
 *
 * И второ: интерфейсът следи статуса. Види ли FAILED, балансът вече е верен —
 * няма миг, в който пише „не се получи", а кредитът още го няма.
 *
 * Себестойността се нулира — за неуспяла генерация не плащаме, значи не
 * бива да тежи и на дневния таван.
 */
export async function failGeneration(
  generationId: string,
  errorCode: string,
): Promise<void> {
  const { refundCredit } = await import('./credits');

  const generation = await dbSystem().generation.findUnique({
    where: { id: generationId },
    select: { userId: true, status: true },
  });
  if (!generation) return;

  // Вече приключила генерация не се пипа втори път.
  if (generation.status === 'DONE' || generation.status === 'FAILED') return;

  // `refundCredit` е идемпотентна — повторно извикване не дава втори кредит.
  await refundCredit(generation.userId, generationId);

  await dbSystem().generation.update({
    where: { id: generationId },
    data: {
      status: 'FAILED',
      errorCode,
      costUSD: null,
      completedAt: new Date(),
    },
  });
}
