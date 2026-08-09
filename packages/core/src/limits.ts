/**
 * АВАРИЙНИТЕ СПИРАЧКИ
 *
 * Три спирачки, подредени от най-важната надолу:
 *
 *   1. ГЛОБАЛЕН ДНЕВЕН ТАВАН — единствената, която пази от катастрофа.
 *      Без нея една дупка в защитата значи сметка от €3000 за една нощ.
 *      С нея — най-много колкото сме казали, плюс имейл до нас.
 *
 *   2. Дневен лимит на потребител — пази от един разгорещен акаунт.
 *
 *   3. Изчакване между две заявки — пази от двоен натиск на бутона и от
 *      два отворени таба.
 *
 * ═══ ЗАЩО СЕБЕСТОЙНОСТТА СЕ ЗАПАЗВА ПРИ СЪЗДАВАНЕ ═══
 *
 * Заданието казва работникът да запише `costUSD` при успех. Ако броим само
 * завършените, сто едновременни заявки минават проверката ЗАЕДНО — всяка
 * вижда нулев разход — и после всичките сто се изпълняват.
 *
 * Затова записваме очакваната себестойност още при създаването на реда,
 * докато е `QUEUED`. Таванът брои поетите задължения, не само платените.
 * При провал стойността се нулира — за неуспяла генерация не плащаме.
 */

import { dbSystem } from '@probvai/db';
import { env } from './env';
import { alertAdmin } from './mail';
import { startOfDay } from './time';

export type BrakeReason =
  | 'GLOBAL_DAILY_CAP'
  | 'USER_DAILY_LIMIT'
  | 'COOLDOWN'
  | 'MAINTENANCE';

export type BrakeResult =
  | { allowed: true }
  | { allowed: false; reason: BrakeReason; retryAfterSeconds?: number };

const ALLOWED: BrakeResult = { allowed: true };

// ---------------------------------------------------------------------------
// 1. Глобален дневен таван
// ---------------------------------------------------------------------------

/** Сумата на поетата себестойност за днес, в долари. */
export async function spentToday(now: Date = new Date()): Promise<number> {
  const result = await dbSystem().generation.aggregate({
    where: { createdAt: { gte: startOfDay(now) } },
    _sum: { costUSD: true },
  });

  const sum = result._sum.costUSD;
  return sum ? Number(sum) : 0;
}

/**
 * Пуска ли се още една генерация със себестойност `nextCostUSD`.
 *
 * При достигане на тавана и при преминаване на прага за предупреждение
 * изпраща имейл. Предупреждението тръгва точно веднъж на ден, защото се
 * праща само в заявката, която ПРЕСИЧА прага.
 */
export async function checkGlobalDailyCap(
  nextCostUSD: number,
  now: Date = new Date(),
): Promise<BrakeResult> {
  const cap = env.MAX_DAILY_SPEND_USD;
  const before = await spentToday(now);
  const after = before + nextCostUSD;

  if (after > cap) {
    void alertAdmin(
      'ДНЕВНИЯТ ТАВАН Е ДОСТИГНАТ — генерациите спряха',
      [
        `Разход за днес: $${before.toFixed(4)}`,
        `Таван:          $${cap.toFixed(2)}`,
        '',
        'Всички генерации са спрени до полунощ българско време.',
        'Ако това е нормално натоварване, вдигни MAX_DAILY_SPEND_USD.',
        'Ако не е — виж дали някой не злоупотребява.',
      ].join('\n'),
    );

    return { allowed: false, reason: 'GLOBAL_DAILY_CAP' };
  }

  const warnAt = (cap * env.DAILY_SPEND_ALERT_PCT) / 100;
  if (before < warnAt && after >= warnAt) {
    void alertAdmin(
      `Разходът за днес мина ${env.DAILY_SPEND_ALERT_PCT}% от тавана`,
      [
        `Разход за днес: $${after.toFixed(4)}`,
        `Таван:          $${cap.toFixed(2)}`,
        '',
        'Още е рано за паника, но е добре да погледнеш.',
      ].join('\n'),
    );
  }

  return ALLOWED;
}

// ---------------------------------------------------------------------------
// 2. Дневен лимит на потребител
// ---------------------------------------------------------------------------

export async function checkUserDailyLimit(
  userId: string,
  now: Date = new Date(),
): Promise<BrakeResult> {
  const used = await dbSystem().generation.count({
    where: { userId, createdAt: { gte: startOfDay(now) } },
  });

  if (used >= env.MAX_GENERATIONS_PER_USER_PER_DAY) {
    return { allowed: false, reason: 'USER_DAILY_LIMIT' };
  }
  return ALLOWED;
}

// ---------------------------------------------------------------------------
// 3. Изчакване между две заявки
// ---------------------------------------------------------------------------

export async function checkCooldown(
  userId: string,
  now: Date = new Date(),
): Promise<BrakeResult> {
  const cooldown = env.GENERATION_COOLDOWN_SECONDS;
  if (cooldown <= 0) return ALLOWED;

  const last = await dbSystem().generation.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  if (!last) return ALLOWED;

  const elapsed = (now.getTime() - last.createdAt.getTime()) / 1000;
  if (elapsed < cooldown) {
    return {
      allowed: false,
      reason: 'COOLDOWN',
      retryAfterSeconds: Math.max(1, Math.ceil(cooldown - elapsed)),
    };
  }

  return ALLOWED;
}

// ---------------------------------------------------------------------------
// Всички заедно, в реда от заданието
// ---------------------------------------------------------------------------

/**
 * Реши се ли да пуснем генерация. Редът е нарочен: първо изчакването
 * (най-евтината проверка), после глобалният таван (най-важната), накрая
 * дневният лимит на потребителя.
 */
export async function checkAllBrakes(
  userId: string,
  nextCostUSD: number,
  now: Date = new Date(),
): Promise<BrakeResult> {
  const cooldown = await checkCooldown(userId, now);
  if (!cooldown.allowed) return cooldown;

  const global = await checkGlobalDailyCap(nextCostUSD, now);
  if (!global.allowed) return global;

  const daily = await checkUserDailyLimit(userId, now);
  if (!daily.allowed) return daily;

  return ALLOWED;
}
