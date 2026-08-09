import { resetWithAnswer, MIN_PASSWORD_LENGTH, type ResetFailure } from '@probvai/core';
import { jsonError, readJson } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/nalog/nova-parola — нова парола срещу верен таен отговор.
 *
 * След смяна ВСИЧКИ отворени сесии падат — това става в `resetWithAnswer`.
 * Смяната на парола обикновено значи, че някой друг е имал достъп; оставим
 * ли неговата сесия жива, смяната не е свършила нищо.
 *
 * Затова тук не се създава нова сесия. Човекът влиза наново, с новата
 * парола — една стъпка повече, но без нея не е ясно кой всъщност е влязъл.
 */

const MESSAGES: Record<ResetFailure, string> = {
  BAD_ANSWER: 'Отговорът не съвпада.',
  WEAK_PASSWORD: `Паролата трябва да е поне ${MIN_PASSWORD_LENGTH} знака.`,
  PASSWORDS_DIFFER: 'Двете пароли не съвпадат.',
  LOCKED: 'Прекалено много опити. Пробвай пак след час.',
  NO_PASSWORD_ACCOUNT: 'Този профил влиза с Google, Apple или Facebook — няма парола.',
};

type Body = {
  email?: unknown;
  answer?: unknown;
  password?: unknown;
  passwordConfirm?: unknown;
};

export async function POST(request: Request): Promise<Response> {
  const body = await readJson<Body>(request);
  if (!body) {
    return jsonError(400, 'BAD_REQUEST', 'Заявката не е правилно оформена.');
  }

  const result = await resetWithAnswer({
    email: body.email,
    answer: body.answer,
    password: body.password,
    passwordConfirm: body.passwordConfirm,
  });

  if (!result.ok) {
    const status = result.reason === 'LOCKED' ? 429 : 400;
    return jsonError(status, result.reason, MESSAGES[result.reason]);
  }

  return Response.json({ ok: true });
}
