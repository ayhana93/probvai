/**
 * Хеширане и нормализиране на самоличности.
 *
 * При изтриване на профил пазим само SHA-256 хешове — необратимо и
 * GDPR-съвместимо. Служат само за едно: да не даваме безплатни кредити при
 * повторна регистрация със същия имейл, телефон или устройство.
 */

import { createHash } from 'node:crypto';

/** SHA-256 в шестнайсетичен вид. */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Привежда имейла към сравним вид.
 *
 * Нарочно НЕ махаме точките в gmail адресите и не режем `+етикет`.
 * Изглежда като добра идея срещу злоупотреба, но удря и реални хора,
 * които ползват `име+магазин@gmail.com`. Разпознаването на еднократните
 * пощи е работа на рисковата оценка от Фаза 6.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Привежда телефона към международен формат.
 * Приема `0888123456`, `359888123456`, `+359 888 123 456` и връща `+359888123456`.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');

  if (digits.startsWith('+')) return `+${digits.slice(1).replace(/\D/g, '')}`;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  // Български номер, записан с водеща нула.
  if (digits.startsWith('0')) return `+359${digits.slice(1)}`;
  return `+${digits}`;
}

/** Груба проверка за смислен международен номер. */
export function isPlausiblePhone(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

export function hashEmail(email: string): string {
  return sha256Hex(normalizeEmail(email));
}

export function hashPhone(phone: string): string {
  return sha256Hex(normalizePhone(phone));
}
