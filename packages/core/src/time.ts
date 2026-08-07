/**
 * Работа с дни в българско време.
 *
 * „Днес" за дневния таван значи днес в София, не в UTC. Иначе таванът се
 * нулира в 3 през нощта българско време и отчетът не съвпада с това, което
 * виждам в банката.
 */

import { env } from './env';

/** Отместването на дадена зона спрямо UTC в конкретен момент, в милисекунди. */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');

  const asIfUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  );

  return asIfUtc - date.getTime();
}

/** Полунощ на текущия ден в зоната на приложението. */
export function startOfDay(now: Date = new Date(), timeZone?: string): Date {
  const zone = timeZone ?? env.APP_TIMEZONE;
  const offset = zoneOffsetMs(now, zone);

  const local = new Date(now.getTime() + offset);
  const midnightAsUtc = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
  );

  return new Date(midnightAsUtc - offset);
}

/** Момент преди `days` дни. */
export function daysAgo(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
