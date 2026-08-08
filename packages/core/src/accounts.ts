/**
 * АКАУНТИ С ПАРОЛА
 *
 * Входът с Google/Apple/Facebook си остава и минава през Auth.js. Тук е
 * другият път: собствен акаунт с имейл и парола.
 *
 * ═══ ЕДНО ПРАВИЛО ЗА СЪОБЩЕНИЯТА ═══
 *
 * При неуспешен вход НЕ казваме дали е сгрешен имейлът или паролата.
 * „Няма такъв имейл" превръща формата за вход в проверка кой има профил
 * при нас — с един списък адреси и малко търпение всеки може да го изкара.
 * Затова и двете дават едно и също съобщение.
 *
 * ═══ ЗАЩО РЕГИСТРАЦИЯТА ВСЕ ПАК КАЗВА „ТОЗИ ИМЕЙЛ Е ЗАЕТ" ═══
 *
 * Защото няма как иначе. Човек, който се регистрира, трябва да разбере
 * защо не става. Тук укриването не пази нищо — то само прави формата
 * неизползваема.
 */

import { dbSystem, Prisma, type Gender } from '@probvai/db';
import { hashEmail, normalizeEmail, normalizePhone, isPlausiblePhone } from './hash';
import {
  hashAnswer,
  hashPassword,
  passwordProblem,
  verifyAnswer,
  verifyPassword,
} from './password';
import { MAX_AGE, MIN_AGE, isGender } from './profile';
import { decoyQuestionFor, isSecurityQuestion, questionText } from './security-questions';

/** След толкова грешни отговора възстановяването се заключва. */
const MAX_RESET_ATTEMPTS = 5;
const RESET_LOCK_MINUTES = 60;

const NAME_MAX = 60;

// ---------------------------------------------------------------------------
// Регистрация
// ---------------------------------------------------------------------------

export type RegisterInput = {
  firstName: unknown;
  lastName: unknown;
  email: unknown;
  phone: unknown;
  age: unknown;
  gender: unknown;
  password: unknown;
  passwordConfirm: unknown;
  securityQuestion: unknown;
  securityAnswer: unknown;
  /** Отметката „приемам условията и политиката". */
  acceptedTerms: unknown;
};

export type RegisterFailure =
  | 'BAD_FIRST_NAME'
  | 'BAD_LAST_NAME'
  | 'BAD_EMAIL'
  | 'BAD_PHONE'
  | 'BAD_AGE'
  | 'TOO_YOUNG'
  | 'BAD_GENDER'
  | 'WEAK_PASSWORD'
  | 'PASSWORDS_DIFFER'
  | 'BAD_QUESTION'
  | 'BAD_ANSWER'
  | 'TERMS_NOT_ACCEPTED'
  | 'EMAIL_TAKEN'
  | 'PHONE_TAKEN';

export type RegisterResult =
  | { ok: true; userId: string }
  | { ok: false; reason: RegisterFailure };

function cleanName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length < 2 || trimmed.length > NAME_MAX) return null;
  return trimmed;
}

export async function registerWithPassword(
  input: RegisterInput,
): Promise<RegisterResult> {
  // ═══ СЪГЛАСИЕТО СЕ ПРОВЕРЯВА И ТУК ═══
  //
  // Отметката в интерфейса не е доказателство за нищо — заявката се праща и
  // без нея, с една команда. А съгласието трябва да е дадено, не показано.
  // Затова проверката е първа: без нея профил не се създава изобщо.
  if (input.acceptedTerms !== true) {
    return { ok: false, reason: 'TERMS_NOT_ACCEPTED' };
  }

  const firstName = cleanName(input.firstName);
  if (!firstName) return { ok: false, reason: 'BAD_FIRST_NAME' };

  const lastName = cleanName(input.lastName);
  if (!lastName) return { ok: false, reason: 'BAD_LAST_NAME' };

  if (typeof input.email !== 'string') return { ok: false, reason: 'BAD_EMAIL' };
  const email = normalizeEmail(input.email);
  // Нарочно проста проверка. Единственият надежден тест за имейл е да
  // пратиш писмо; регулярен израз, който гони RFC, отхвърля валидни адреси.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, reason: 'BAD_EMAIL' };
  }

  // ⚠ Първо се нормализира, чак после се проверява. Обратният ред отказваше
  // „0888 123 456" — тоест точно това, което формата дава за пример, и точно
  // както го пише всеки в България. `isPlausiblePhone` очаква вече
  // международен номер.
  if (typeof input.phone !== 'string') return { ok: false, reason: 'BAD_PHONE' };
  const phone = normalizePhone(input.phone);
  if (!isPlausiblePhone(phone)) return { ok: false, reason: 'BAD_PHONE' };

  const age = Number(input.age);
  if (!Number.isInteger(age) || age < 1 || age > MAX_AGE) {
    return { ok: false, reason: 'BAD_AGE' };
  }
  if (age < MIN_AGE) return { ok: false, reason: 'TOO_YOUNG' };

  if (!isGender(input.gender)) return { ok: false, reason: 'BAD_GENDER' };

  if (passwordProblem(input.password) !== null) {
    return { ok: false, reason: 'WEAK_PASSWORD' };
  }
  if (input.password !== input.passwordConfirm) {
    return { ok: false, reason: 'PASSWORDS_DIFFER' };
  }

  if (!isSecurityQuestion(input.securityQuestion)) {
    return { ok: false, reason: 'BAD_QUESTION' };
  }
  if (typeof input.securityAnswer !== 'string' || input.securityAnswer.trim().length < 2) {
    return { ok: false, reason: 'BAD_ANSWER' };
  }

  const [passwordHash, securityAnswerHash] = await Promise.all([
    hashPassword(input.password as string),
    hashAnswer(input.securityAnswer),
  ]);

  try {
    const user = await dbSystem().user.create({
      data: {
        email,
        phone,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        gender: input.gender as Gender,
        birthYear: new Date().getFullYear() - age,
        passwordHash,
        securityQuestion: input.securityQuestion,
        securityAnswerHash,
        // Профилът е попълнен още тук — тази форма пита всичко.
        profileCompletedAt: new Date(),
        // Датата е доказателството, че съгласието е дадено. Булево поле
        // „да, съгласи се" не отговаря на въпроса КОГА и за коя версия.
        termsAcceptedAt: new Date(),
        // Публичният гардероб се включва нарочно, от настройките. Решение с
        // необратими последствия не се взима между две полета на регистрация.
        wardrobePublic: false,
      },
      select: { id: true },
    });

    // Безплатните кредити минават през същия път като при вход с Google —
    // едно място решава кой колко получава.
    const { reconcileFreeCredits } = await import('./free-credits');
    await reconcileFreeCredits(user.id);

    return { ok: true, userId: user.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = String(error.meta?.target ?? '');
      return { ok: false, reason: target.includes('phone') ? 'PHONE_TAKEN' : 'EMAIL_TAKEN' };
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Вход
// ---------------------------------------------------------------------------

export type LoginResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'BAD_CREDENTIALS' | 'SUSPENDED' };

/**
 * Проверява имейл и парола.
 *
 * ═══ ЗАЩО СЕ ХЕШИРА И КОГАТО ПОТРЕБИТЕЛЯТ НЕ СЪЩЕСТВУВА ═══
 *
 * Ако при непознат имейл връщахме отказ веднага, отговорът щеше да идва за
 * милисекунди, а при познат — за десетки. Тази разлика се мери и издава
 * кои адреси имат профил.
 *
 * Затова при липсващ потребител се проверява фиктивен хеш. Времето излиза
 * същото.
 */
export async function verifyCredentials(
  rawEmail: unknown,
  password: unknown,
): Promise<LoginResult> {
  const fail = { ok: false, reason: 'BAD_CREDENTIALS' } as const;

  if (typeof rawEmail !== 'string' || typeof password !== 'string') return fail;

  const user = await dbSystem().user.findUnique({
    where: { email: normalizeEmail(rawEmail) },
    select: { id: true, passwordHash: true, status: true },
  });

  if (!user?.passwordHash) {
    // Изгаряме същото време, което би отнела истинска проверка.
    await verifyPassword(password, await decoyHash());
    return fail;
  }

  if (!(await verifyPassword(password, user.passwordHash))) return fail;
  if (user.status !== 'ACTIVE') return { ok: false, reason: 'SUSPENDED' };

  return { ok: true, userId: user.id };
}

/**
 * Фиктивен хеш за изравняване на времето. Прави се веднъж и се пази —
 * иначе самото му правене щеше да добавя време и пак да има разлика.
 */
let decoy: string | undefined;
async function decoyHash(): Promise<string> {
  decoy ??= await hashPassword('няма такъв потребител');
  return decoy;
}

// ---------------------------------------------------------------------------
// Забравена парола
// ---------------------------------------------------------------------------

export type QuestionLookup = { question: string; text: string };

/**
 * Връща тайния въпрос за даден имейл.
 *
 * За непознат имейл връща въпрос ВСЕ ПАК — избран по хеш на адреса, тоест
 * винаги един и същ. Иначе този екран щеше да е проверка кой има профил
 * при нас. Отговорът после просто не съвпада.
 */
export async function questionForEmail(rawEmail: unknown): Promise<QuestionLookup | null> {
  if (typeof rawEmail !== 'string' || rawEmail.trim().length === 0) return null;

  const email = normalizeEmail(rawEmail);

  const user = await dbSystem().user.findUnique({
    where: { email },
    select: { securityQuestion: true },
  });

  const key = user?.securityQuestion;
  if (key) {
    const text = questionText(key);
    if (text) return { question: key, text };
  }

  const fake = decoyQuestionFor(email);
  return { question: fake.key, text: fake.text };
}

export type ResetFailure =
  | 'BAD_ANSWER'
  | 'WEAK_PASSWORD'
  | 'PASSWORDS_DIFFER'
  | 'LOCKED'
  | 'NO_PASSWORD_ACCOUNT';

export type ResetResult = { ok: true } | { ok: false; reason: ResetFailure };

/**
 * Сменя паролата срещу верен отговор на тайния въпрос.
 *
 * ═══ ЗАЩО ИМА БРОЯЧ НА ОПИТИТЕ ═══
 *
 * Отговорите на тайни въпроси са къси и от малък набор — имена на кучета,
 * улици, ястия. Без ограничение те се налучкват за часове, и то от машина.
 * Пет грешни опита заключват възстановяването за час.
 *
 * Броячът се нулира при верен отговор и при успешен вход с парола.
 */
export async function resetWithAnswer(input: {
  email: unknown;
  answer: unknown;
  password: unknown;
  passwordConfirm: unknown;
}): Promise<ResetResult> {
  if (typeof input.email !== 'string' || typeof input.answer !== 'string') {
    return { ok: false, reason: 'BAD_ANSWER' };
  }

  if (passwordProblem(input.password) !== null) {
    return { ok: false, reason: 'WEAK_PASSWORD' };
  }
  if (input.password !== input.passwordConfirm) {
    return { ok: false, reason: 'PASSWORDS_DIFFER' };
  }

  const email = normalizeEmail(input.email);
  const user = await dbSystem().user.findUnique({
    where: { email },
    select: {
      id: true,
      securityAnswerHash: true,
      passwordHash: true,
      resetAttempts: true,
      resetLockedAt: true,
    },
  });

  // Непознат имейл: същият отговор като при грешен отговор. Виж по-горе.
  if (!user?.securityAnswerHash) {
    await verifyPassword(input.answer, await decoyHash());
    return { ok: false, reason: 'BAD_ANSWER' };
  }

  if (user.resetLockedAt) {
    const until = user.resetLockedAt.getTime() + RESET_LOCK_MINUTES * 60_000;
    if (Date.now() < until) return { ok: false, reason: 'LOCKED' };
  }

  // Профил без парола е влизал с Google. Смяната на „парола" там няма
  // смисъл — той няма такава и не му трябва.
  if (!user.passwordHash) return { ok: false, reason: 'NO_PASSWORD_ACCOUNT' };

  if (!(await verifyAnswer(input.answer, user.securityAnswerHash))) {
    const attempts = user.resetAttempts + 1;
    await dbSystem().user.update({
      where: { id: user.id },
      data: {
        resetAttempts: attempts,
        ...(attempts >= MAX_RESET_ATTEMPTS ? { resetLockedAt: new Date() } : {}),
      },
    });
    return { ok: false, reason: attempts >= MAX_RESET_ATTEMPTS ? 'LOCKED' : 'BAD_ANSWER' };
  }

  const passwordHash = await hashPassword(input.password as string);

  await dbSystem().$transaction([
    dbSystem().user.update({
      where: { id: user.id },
      data: { passwordHash, resetAttempts: 0, resetLockedAt: null },
    }),
    // Всички отворени сесии падат. Смяната на парола обикновено значи, че
    // някой друг е имал достъп — оставим ли сесиите му живи, смяната не е
    // свършила работа.
    dbSystem().session.deleteMany({ where: { userId: user.id } }),
  ]);

  return { ok: true };
}

/** Нулира брояча след успешен вход — човекът явно си е спомнил. */
export async function clearResetAttempts(userId: string): Promise<void> {
  await dbSystem()
    .user.updateMany({
      where: { id: userId, OR: [{ resetAttempts: { gt: 0 } }, { resetLockedAt: { not: null } }] },
      data: { resetAttempts: 0, resetLockedAt: null },
    })
    .catch(() => undefined);
}

/** Ползва се от проверката за повторна регистрация след изтрит профил. */
export { hashEmail };
