/**
 * КРЕДИТИ — единственият път до баланса.
 *
 * Правило №4 от заданието: никъде другаде в кода не се пише
 * `UPDATE users SET credits = ...`. Базата го налага и на ниво права —
 * ролята `app_user` физически няма UPDATE върху колоната `credits`.
 *
 * Всяка функция тук работи в транзакция, която започва с
 *
 *     SELECT credits FROM users WHERE id = $1 FOR UPDATE
 *
 * Заключването на реда е задължително. Без него два отворени таба минават
 * проверката едновременно и харчат два пъти един кредит.
 *
 * ФАЗА 0: само интерфейсът. Реализацията идва във Фаза 1 заедно с теста за
 * едновременно харчене — 10 паралелни заявки при баланс 5 трябва да дадат
 * точно 5 успешни.
 */

import type { LedgerReason } from '@probvai/db';

/** Защо една операция с кредити е била отказана. */
export type CreditFailure =
  | 'INSUFFICIENT_CREDITS'
  | 'USER_NOT_FOUND'
  | 'USER_SUSPENDED'
  | 'ALREADY_SPENT'
  | 'ALREADY_REFUNDED'
  | 'INVALID_AMOUNT';

export type CreditResult =
  | { ok: true; balance: number; ledgerId: string }
  | { ok: false; reason: CreditFailure; balance: number };

const NOT_IMPLEMENTED = 'Реализацията идва във Фаза 1 — Автентикация и кредити';

/**
 * Удържа един кредит за конкретна генерация.
 * Извиква се ПРЕДИ обръщението към AI доставчика — иначе плащаме за
 * генерации, за които никой не ни е платил.
 */
export async function spendCredit(
  _userId: string,
  _generationId: string,
): Promise<CreditResult> {
  throw new Error(NOT_IMPLEMENTED);
}

/**
 * Добавя кредити: покупка, безплатни при регистрация, ръчна корекция от админ.
 * `refId` сочи към източника — Stripe session, adminId, и т.н.
 */
export async function addCredits(
  _userId: string,
  _amount: number,
  _reason: LedgerReason,
  _refId?: string,
): Promise<CreditResult> {
  throw new Error(NOT_IMPLEMENTED);
}

/**
 * Връща кредита при провалена генерация. Идемпотентна е — повторно
 * извикване за същата генерация не връща втори кредит.
 */
export async function refundCredit(
  _userId: string,
  _generationId: string,
): Promise<CreditResult> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Текущият баланс. Чете кеша в `users.credits`. */
export async function getBalance(_userId: string): Promise<number> {
  throw new Error(NOT_IMPLEMENTED);
}
