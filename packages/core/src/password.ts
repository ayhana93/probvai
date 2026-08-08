/**
 * ПАРОЛИ И ТАЙНИ ОТГОВОРИ
 *
 * ═══ ЗАЩО scrypt, А НЕ БИБЛИОТЕКА ═══
 *
 * bcrypt и argon2 идват с нативен код, който трябва да се компилира за
 * платформата на образа. scrypt е в самия Node — нула зависимости, нула
 * изненади при билд на друга архитектура. И е бавен нарочно: точно това
 * трябва от хеш за пароли.
 *
 * ═══ КАКВО СЕ ПАЗИ ═══
 *
 * Не паролата. Записът е `scrypt$N$r$p$сол$ключ` — солта е различна за
 * всеки, така че две еднакви пароли дават два различни записа и таблицата
 * не издава кой с кого си съвпада.
 *
 * Параметрите влизат В самия запис. Вдигнем ли цената след година, старите
 * записи продължават да се проверяват със своите стойности, а не гърмят.
 *
 * ═══ ТАЙНИТЕ ОТГОВОРИ МИНАВАТ ПРЕЗ СЪЩОТО ═══
 *
 * Отговорът на таен въпрос е втора парола — с него се сменя първата.
 * Пази се по същия начин.
 */

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/**
 * `promisify` избира най-краткия вариант на `scrypt` и изпуска този с
 * настройки. Обвиваме го на ръка, за да можем да подадем цената.
 */
function scryptAsync(
  secret: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(secret, salt, keylen, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/**
 * Цената. 2^14 при r=8 иска около 16 MB памет и няколко десетки
 * милисекунди — достатъчно бавно за налучкване, достатъчно бързо за вход.
 */
const COST = 16_384;
const BLOCK = 8;
const PARALLEL = 1;
const KEY_BYTES = 64;
const MAX_MEM = 64 * 1024 * 1024;

/** Под тази дължина не приемаме парола. */
export const MIN_PASSWORD_LENGTH = 8;

async function derive(
  secret: string,
  salt: Buffer,
  cost: number,
  block: number,
  parallel: number,
): Promise<Buffer> {
  return scryptAsync(secret, salt, KEY_BYTES, {
    N: cost,
    r: block,
    p: parallel,
    maxmem: MAX_MEM,
  });
}

/**
 * Нормализира текст преди хеширане.
 *
 * `NFKC` прави така, че една и съща буква, написана по два начина в Unicode,
 * да дава един и същ хеш. Иначе парола, въведена от друга клавиатура, не
 * съвпада с нищо и никой не разбира защо.
 */
function normalize(value: string): string {
  return value.normalize('NFKC');
}

/** Хешира парола. */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(normalize(plain), salt, COST, BLOCK, PARALLEL);

  return [
    'scrypt',
    COST,
    BLOCK,
    PARALLEL,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$');
}

/**
 * Проверява парола срещу записа.
 *
 * Сравнението е `timingSafeEqual`, не `===`. Обикновеното сравнение спира
 * на първия различен байт и времето му издава колко от хеша е познато.
 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const cost = Number(parts[1]);
  const block = Number(parts[2]);
  const parallel = Number(parts[3]);
  if (!Number.isInteger(cost) || !Number.isInteger(block) || !Number.isInteger(parallel)) {
    return false;
  }

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4]!, 'base64url');
    expected = Buffer.from(parts[5]!, 'base64url');
  } catch {
    return false;
  }
  if (expected.length !== KEY_BYTES) return false;

  let actual: Buffer;
  try {
    actual = await derive(normalize(plain), salt, cost, block, parallel);
  } catch {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

/**
 * Подготвя таен отговор за хеширане.
 *
 * „Шаро", „шаро" и „  Шаро " са един и същ отговор — човек, който си
 * възстановява паролата, не помни с каква буква го е писал преди година.
 * Затова: без разлика в главни и малки, без излишни интервали.
 */
export function normalizeAnswer(answer: string): string {
  return normalize(answer).trim().replace(/\s+/g, ' ').toLowerCase();
}

export async function hashAnswer(answer: string): Promise<string> {
  return hashPassword(normalizeAnswer(answer));
}

export async function verifyAnswer(answer: string, stored: string): Promise<boolean> {
  return verifyPassword(normalizeAnswer(answer), stored);
}

/**
 * Колко е силна паролата. Връща причина или `null`, ако е наред.
 *
 * Нарочно НЯМА изискване за главна буква, цифра и знак. Такива правила
 * карат хората да пишат `Parola1!` — по-къса, по-предсказуема и по-лесна за
 * налучкване от три случайни думи. Дължината е това, което има значение.
 */
export function passwordProblem(plain: unknown): 'TOO_SHORT' | 'NOT_A_STRING' | null {
  if (typeof plain !== 'string') return 'NOT_A_STRING';
  if (normalize(plain).length < MIN_PASSWORD_LENGTH) return 'TOO_SHORT';
  return null;
}
