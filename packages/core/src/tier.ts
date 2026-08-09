/**
 * НИВА И VIP CLOSET
 *
 * ═══ ЗАЩО НЕ СЕ КАЗВА „PREMIUM" ═══
 *
 * „Premium" е абонамент — нещо, което се купува и после се плаща всеки месец,
 * докато човек не се сети да го спре. VIP Closet е нещо, което се ОТКЛЮЧВА.
 * Разликата е в чувството: едното е разход, другото е постижение. Затова
 * никъде в интерфейса не пише „премиум", „план" или „абонамент".
 *
 * ═══ ДВЕ РАЗЛИЧНИ СТЪЛБИЦИ, НАРОЧНО ═══
 *
 * 1. НИВАТА се качват с правене на визии — по една точка на изхарчен кредит.
 *    Те са безплатни и се движат бързо в началото. Целта им е човек да се
 *    върне утре, а не да плати днес.
 *
 * 2. VIP CLOSET се отключва с похарчена сума. Той не е ниво в стълбицата, а
 *    отделен ключ.
 *
 * Ако бяха една стълбица, нивата щяха да са ценоразпис — а ценоразписът не
 * се качва за удоволствие.
 *
 * ═══ КОГА СЕ ДАВА ТОЧКА ═══
 *
 * При ГОТОВА генерация, не при харчене. Провалена генерация връща кредита;
 * ако беше дала и точка, нивото щеше да се качва от нашите грешки.
 */

import { dbSystem } from '@probvai/db';
import { env } from './env';

export type Rank = {
  key: string;
  /** Заглавието е на английски нарочно — това е значка, не изречение. */
  title: string;
  /** Какво значи, на български. */
  note: string;
  /** От колко точки започва. */
  from: number;
  emoji: string;
};

export const RANKS: Rank[] = [
  {
    key: 'newbie',
    title: 'Newbie Stylist',
    note: 'Първи стъпки',
    from: 0,
    emoji: '🌱',
  },
  {
    key: 'lover',
    title: 'Fashion Lover',
    note: 'Вече хващаш вкуса',
    from: 10,
    emoji: '💕',
  },
  {
    key: 'hunter',
    title: 'Trend Hunter',
    note: 'Знаеш какво идва',
    from: 30,
    emoji: '🎯',
  },
  {
    key: 'expert',
    title: 'Style Expert',
    note: 'Комбинираш без грешка',
    from: 75,
    emoji: '⚡',
  },
  {
    key: 'icon',
    title: 'Fashion Icon',
    note: 'Другите гледат теб',
    from: 150,
    emoji: '👑',
  },
];

/** Ключът, който VIP Closet отключва. Не е ниво — стои над стълбицата. */
export const VIP = {
  key: 'vip',
  title: 'VIP Closet',
  note: 'Снимки в HD · значка · с предимство на опашката',
  emoji: '🔑',
} as const;

export type TierState = {
  xp: number;
  rank: Rank;
  /** Следващото ниво, или `null` на върха на стълбицата. */
  next: Rank | null;
  /** Колко точки остават до следващото ниво. */
  toNext: number;
  /** Колко от пътя до следващото ниво е изминат, 0–100. */
  progressPct: number;
  vip: boolean;
  /** Похарчено досега, в евро, за показване: „37.40". */
  spentEur: string;
  /** Колко евро остават до VIP Closet. Нула, когато е отключен. */
  toVipEur: string;
};

export function rankFor(xp: number): Rank {
  let current = RANKS[0]!;
  for (const rank of RANKS) {
    if (xp >= rank.from) current = rank;
  }
  return current;
}

function nextRankAfter(rank: Rank): Rank | null {
  const index = RANKS.indexOf(rank);
  return index >= 0 && index < RANKS.length - 1 ? RANKS[index + 1]! : null;
}

/** Прагът за VIP Closet, в евроцентове. */
export function vipThresholdCents(): number {
  return Math.round(env.VIP_THRESHOLD_EUR * 100);
}

export function tierFrom(xp: number, lifetimeSpendCents: number): TierState {
  const rank = rankFor(xp);
  const next = nextRankAfter(rank);
  const threshold = vipThresholdCents();

  const span = next ? next.from - rank.from : 0;
  const done = xp - rank.from;

  return {
    xp,
    rank,
    next,
    toNext: next ? Math.max(0, next.from - xp) : 0,
    progressPct: span > 0 ? Math.min(100, Math.round((done / span) * 100)) : 100,
    vip: lifetimeSpendCents >= threshold,
    spentEur: (lifetimeSpendCents / 100).toFixed(2),
    toVipEur: (Math.max(0, threshold - lifetimeSpendCents) / 100).toFixed(2),
  };
}

/** Състоянието на един потребител. */
export async function tierFor(userId: string): Promise<TierState> {
  const user = await dbSystem().user.findUnique({
    where: { id: userId },
    select: { xp: true, lifetimeSpendCents: true },
  });
  return tierFrom(user?.xp ?? 0, user?.lifetimeSpendCents ?? 0);
}

/**
 * Дава точки за готова визия.
 *
 * `increment` вместо четене и запис: две готови генерации в една секунда не
 * бива да си изядат точките.
 */
export async function awardXp(userId: string, amount = 1): Promise<void> {
  if (amount <= 0) return;
  await dbSystem().user.update({
    where: { id: userId },
    data: { xp: { increment: amount } },
  });
}

/**
 * Записва похарчена сума след потвърдено плащане.
 *
 * Отрицателна стойност при върнато плащане — VIP статус, платен и после
 * поискан обратно, не остава отключен.
 */
export async function recordSpend(userId: string, cents: number): Promise<void> {
  if (cents === 0) return;
  await dbSystem().user.update({
    where: { id: userId },
    data: { lifetimeSpendCents: { increment: cents } },
  });
}

/**
 * Има ли предимство на опашката.
 *
 * Ползва се от работника при подредбата. Приоритетът е истинска полза, но
 * малка — VIP не бива да значи, че останалите чакат вечно.
 */
export async function hasQueuePriority(userId: string): Promise<boolean> {
  return (await tierFor(userId)).vip;
}
