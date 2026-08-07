import { verifyPhoneCode, type VerifyFailure } from '@probvai/core';
import { jsonError, readJson, requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MESSAGES: Record<VerifyFailure, { status: number; text: string }> = {
  NO_PENDING_CODE: { status: 400, text: 'Няма изпратен код. Поискай нов.' },
  EXPIRED: { status: 410, text: 'Кодът изтече. Поискай нов.' },
  TOO_MANY_ATTEMPTS: { status: 429, text: 'Прекалено много грешни опити. Поискай нов код.' },
  WRONG_CODE: { status: 400, text: 'Кодът не съвпада. Провери го и опитай пак.' },
  PHONE_IN_USE: { status: 409, text: 'Този номер вече се използва от друг профил.' },
  USER_NOT_FOUND: { status: 401, text: 'Трябва да влезеш в профила си.' },
};

export async function POST(request: Request): Promise<Response> {
  const session = await requireUser();
  if (session.response) return session.response;

  const body = await readJson<{ code?: unknown }>(request);
  if (!body || typeof body.code !== 'string' || !/^\d{4,8}$/.test(body.code.trim())) {
    return jsonError(400, 'BAD_REQUEST', 'Въведи кода от SMS-а.');
  }

  const result = await verifyPhoneCode(session.user.id, body.code);

  if (!result.ok) {
    const { status, text } = MESSAGES[result.reason];
    return jsonError(status, result.reason, text);
  }

  return Response.json({
    phoneVerified: true,
    creditsGranted: result.credits.granted,
    balance: result.credits.balance,
  });
}
