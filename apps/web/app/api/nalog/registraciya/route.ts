import { registerWithPassword, MIN_PASSWORD_LENGTH, type RegisterFailure } from '@probvai/core';
import { createSession } from '@/lib/session-cookie';
import { jsonError, readJson } from '@/lib/session';
import { MIN_AGE } from '@probvai/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/nalog/registraciya — нов акаунт с парола.
 *
 * След успех човекът влиза веднага. Регистрация, след която трябва да се
 * влезе отново, е излишна стъпка на най-крехкото място в целия поток —
 * там, където хората се отказват.
 */

const MESSAGES: Record<RegisterFailure, string> = {
  BAD_FIRST_NAME: 'Напиши името си.',
  BAD_LAST_NAME: 'Напиши фамилията си.',
  BAD_EMAIL: 'Провери имейла.',
  BAD_PHONE: 'Провери телефона. Пример: 0888 123 456',
  BAD_AGE: 'Напиши възрастта си.',
  TOO_YOUNG: `Приложението е за хора над ${MIN_AGE} години.`,
  BAD_GENDER: 'Избери пол.',
  WEAK_PASSWORD: `Паролата трябва да е поне ${MIN_PASSWORD_LENGTH} знака.`,
  PASSWORDS_DIFFER: 'Двете пароли не съвпадат.',
  BAD_QUESTION: 'Избери таен въпрос.',
  BAD_ANSWER: 'Напиши отговор на тайния въпрос.',
  TERMS_NOT_ACCEPTED: 'Трябва да приемеш условията и политиката за поверителност.',
  EMAIL_TAKEN: 'Вече има профил с този имейл. Влез вместо това.',
  PHONE_TAKEN: 'Вече има профил с този телефон.',
};

type Body = Record<string, unknown>;

export async function POST(request: Request): Promise<Response> {
  const body = await readJson<Body>(request);
  if (!body) {
    return jsonError(400, 'BAD_REQUEST', 'Заявката не е правилно оформена.');
  }

  const result = await registerWithPassword({
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    phone: body.phone,
    age: body.age,
    gender: body.gender,
    password: body.password,
    passwordConfirm: body.passwordConfirm,
    securityQuestion: body.securityQuestion,
    securityAnswer: body.securityAnswer,
    acceptedTerms: body.acceptedTerms,
  });

  if (!result.ok) {
    const status = result.reason === 'EMAIL_TAKEN' || result.reason === 'PHONE_TAKEN' ? 409 : 400;
    return jsonError(status, result.reason, MESSAGES[result.reason]);
  }

  await createSession(result.userId);

  return Response.json({ ok: true });
}
