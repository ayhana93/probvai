/**
 * АКАУНТИ С ПАРОЛА
 *
 * Четирите неща, които трябва да са верни:
 *   1. паролата не се пази като текст и еднакви пароли дават различни записи;
 *   2. входът не издава кой има профил при нас;
 *   3. тайният въпрос не може да се налучква безкрайно;
 *   4. смяната на парола изхвърля всички отворени сесии.
 */

import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { dbSystem, disconnectAll } from '@probvai/db';
import {
  questionForEmail,
  registerWithPassword,
  resetWithAnswer,
  verifyCredentials,
} from '../src/accounts';
import { hashPassword, normalizeAnswer, verifyPassword } from '../src/password';
import { decoyQuestionFor } from '../src/security-questions';

const system = dbSystem();
const created: string[] = [];

function newEmail(): string {
  return `acc-${crypto.randomUUID()}@example.test`;
}

async function makeAccount(overrides: Record<string, unknown> = {}) {
  const email = (overrides.email as string) ?? newEmail();

  const result = await registerWithPassword({
    firstName: 'Иван',
    lastName: 'Иванов',
    email,
    phone: `+3598${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
    age: 30,
    gender: 'MALE',
    password: 'три случайни думи',
    passwordConfirm: 'три случайни думи',
    securityQuestion: 'pet',
    securityAnswer: 'Шаро',
    ...overrides,
  });

  if (result.ok) created.push(result.userId);
  return { result, email };
}

afterEach(async () => {
  if (created.length > 0) {
    await system.user.deleteMany({ where: { id: { in: created } } });
    created.length = 0;
  }
});

afterAll(async () => {
  await disconnectAll();
});

// ---------------------------------------------------------------------------

describe('Хеширане на пароли', () => {
  it('записът не съдържа паролата', async () => {
    const stored = await hashPassword('тайна парола 123');
    expect(stored).not.toContain('тайна');
    expect(stored.startsWith('scrypt$')).toBe(true);
  });

  it('две еднакви пароли дават два различни записа', async () => {
    // Заради солта. Иначе таблицата издава кои хора имат една и съща парола.
    const a = await hashPassword('еднаква парола');
    const b = await hashPassword('еднаква парола');
    expect(a).not.toBe(b);
    expect(await verifyPassword('еднаква парола', a)).toBe(true);
    expect(await verifyPassword('еднаква парола', b)).toBe(true);
  });

  it('грешна парола не минава', async () => {
    const stored = await hashPassword('правилната');
    expect(await verifyPassword('грешната', stored)).toBe(false);
  });

  it('развален запис не минава за вярна парола', async () => {
    for (const junk of ['', 'боклук', 'scrypt$16384$8$1$само-три-части', '$$$$$']) {
      expect(await verifyPassword('каквото и да е', junk)).toBe(false);
    }
  });

  it('отговорите се сравняват без оглед на главни букви и интервали', () => {
    expect(normalizeAnswer('  Шаро  ')).toBe('шаро');
    expect(normalizeAnswer('ШАРО')).toBe('шаро');
    expect(normalizeAnswer('черен  котарак')).toBe('черен котарак');
  });
});

describe('Регистрация', () => {
  it('създава профил и той може да влезе', async () => {
    const { result, email } = await makeAccount();
    expect(result.ok).toBe(true);

    const login = await verifyCredentials(email, 'три случайни думи');
    expect(login.ok).toBe(true);
  });

  it('в базата не влиза самата парола', async () => {
    const { result } = await makeAccount();
    if (!result.ok) throw new Error('не се създаде');

    const user = await system.user.findUniqueOrThrow({ where: { id: result.userId } });
    expect(user.passwordHash).not.toBeNull();
    expect(user.passwordHash).not.toContain('три случайни думи');
    expect(user.securityAnswerHash).not.toContain('Шаро');
    expect(user.securityAnswerHash).not.toContain('шаро');
  });

  it('вторият профил със същия имейл се отказва', async () => {
    const email = newEmail();
    await makeAccount({ email });
    const second = await makeAccount({ email });
    expect(second.result).toMatchObject({ ok: false, reason: 'EMAIL_TAKEN' });
  });

  it('къса парола, разминати пароли и непълнолетие не минават', async () => {
    expect((await makeAccount({ password: 'къса', passwordConfirm: 'къса' })).result)
      .toMatchObject({ ok: false, reason: 'WEAK_PASSWORD' });

    expect((await makeAccount({ passwordConfirm: 'друго нещо съвсем' })).result)
      .toMatchObject({ ok: false, reason: 'PASSWORDS_DIFFER' });

    expect((await makeAccount({ age: 14 })).result)
      .toMatchObject({ ok: false, reason: 'TOO_YOUNG' });
  });

  it('измислен таен въпрос не минава', async () => {
    expect((await makeAccount({ securityQuestion: 'какъвто си искам' })).result)
      .toMatchObject({ ok: false, reason: 'BAD_QUESTION' });
  });
});

describe('Вход', () => {
  it('непознат имейл и грешна парола дават една и съща причина', async () => {
    // Иначе формата за вход става проверка кой има профил при нас.
    const { email } = await makeAccount();

    const wrongPassword = await verifyCredentials(email, 'нещо съвсем друго');
    const unknownEmail = await verifyCredentials(newEmail(), 'нещо съвсем друго');

    expect(wrongPassword).toEqual(unknownEmail);
    expect(wrongPassword).toMatchObject({ ok: false, reason: 'BAD_CREDENTIALS' });
  });

  it('спрян профил не влиза', async () => {
    const { result, email } = await makeAccount();
    if (!result.ok) throw new Error('не се създаде');

    await system.user.update({ where: { id: result.userId }, data: { status: 'SUSPENDED' } });

    expect(await verifyCredentials(email, 'три случайни думи'))
      .toMatchObject({ ok: false, reason: 'SUSPENDED' });
  });
});

describe('Забравена парола', () => {
  it('непознат имейл също получава въпрос', async () => {
    // Иначе този екран е безплатна проверка кой има профил при нас.
    const email = newEmail();
    const found = await questionForEmail(email);

    expect(found).not.toBeNull();
    expect(found?.text.length).toBeGreaterThan(0);
    // И е винаги един и същ — променлив въпрос би издал измамата веднага.
    expect(found?.question).toBe(decoyQuestionFor(email).key);
    expect((await questionForEmail(email))?.question).toBe(found?.question);
  });

  it('верният отговор сменя паролата', async () => {
    const { email } = await makeAccount();

    expect(
      await resetWithAnswer({
        email,
        answer: '  шАрО ',
        password: 'нова дълга парола',
        passwordConfirm: 'нова дълга парола',
      }),
    ).toEqual({ ok: true });

    expect(await verifyCredentials(email, 'нова дълга парола')).toMatchObject({ ok: true });
    expect(await verifyCredentials(email, 'три случайни думи')).toMatchObject({ ok: false });
  });

  it('смяната изхвърля всички отворени сесии', async () => {
    // Смяна на парола обикновено значи, че някой друг е имал достъп.
    // Оставим ли сесията му жива, смяната не е свършила нищо.
    const { result, email } = await makeAccount();
    if (!result.ok) throw new Error('не се създаде');

    await system.session.createMany({
      data: [
        { sessionToken: crypto.randomUUID(), userId: result.userId, expires: new Date(Date.now() + 86_400_000) },
        { sessionToken: crypto.randomUUID(), userId: result.userId, expires: new Date(Date.now() + 86_400_000) },
      ],
    });
    expect(await system.session.count({ where: { userId: result.userId } })).toBe(2);

    await resetWithAnswer({
      email,
      answer: 'Шаро',
      password: 'съвсем нова парола',
      passwordConfirm: 'съвсем нова парола',
    });

    expect(await system.session.count({ where: { userId: result.userId } })).toBe(0);
  });

  it('пет грешни отговора заключват възстановяването', async () => {
    const { email } = await makeAccount();

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      expect(
        await resetWithAnswer({
          email,
          answer: 'грешен',
          password: 'нова дълга парола',
          passwordConfirm: 'нова дълга парола',
        }),
      ).toMatchObject({ ok: false, reason: 'BAD_ANSWER' });
    }

    expect(
      await resetWithAnswer({
        email,
        answer: 'грешен',
        password: 'нова дълга парола',
        passwordConfirm: 'нова дълга парола',
      }),
    ).toMatchObject({ ok: false, reason: 'LOCKED' });

    // И верният отговор вече не минава, докато трае заключването.
    expect(
      await resetWithAnswer({
        email,
        answer: 'Шаро',
        password: 'нова дълга парола',
        passwordConfirm: 'нова дълга парола',
      }),
    ).toMatchObject({ ok: false, reason: 'LOCKED' });
  });

  it('профил без парола не се „възстановява"', async () => {
    // Влизал е с Google. Няма парола и не му трябва.
    const user = await system.user.create({
      data: {
        email: newEmail(),
        securityQuestion: 'pet',
        securityAnswerHash: await hashPassword(normalizeAnswer('Шаро')),
      },
      select: { id: true, email: true },
    });
    created.push(user.id);

    expect(
      await resetWithAnswer({
        email: user.email,
        answer: 'Шаро',
        password: 'нова дълга парола',
        passwordConfirm: 'нова дълга парола',
      }),
    ).toMatchObject({ ok: false, reason: 'NO_PASSWORD_ACCOUNT' });
  });
});
