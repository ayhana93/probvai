import { startPhoneVerification, type StartFailure } from '@probvai/core';
import { jsonError, readJson, requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Съобщения за човека. Никое от тях не издава вътрешни подробности. */
const MESSAGES: Record<StartFailure, { status: number; text: string }> = {
  INVALID_PHONE: { status: 400, text: 'Този номер не изглежда правилен. Провери го.' },
  PHONE_IN_USE: { status: 409, text: 'Този номер вече се използва от друг профил.' },
  ALREADY_VERIFIED: { status: 409, text: 'Телефонът ти вече е потвърден.' },
  COOLDOWN: { status: 429, text: 'Изчакай малко, преди да поискаш нов код.' },
  DAILY_LIMIT: { status: 429, text: 'Прекалено много опити за днес. Опитай утре.' },
  SMS_FAILED: { status: 502, text: 'SMS-ът не тръгна. Опитай пак след минута.' },
  USER_NOT_FOUND: { status: 401, text: 'Трябва да влезеш в профила си.' },
};

export async function POST(request: Request): Promise<Response> {
  const session = await requireUser();
  if (session.response) return session.response;

  const body = await readJson<{ phone?: unknown }>(request);
  if (!body || typeof body.phone !== 'string') {
    return jsonError(400, 'BAD_REQUEST', 'Липсва телефонен номер.');
  }

  const result = await startPhoneVerification(session.user.id, body.phone);

  if (!result.ok) {
    const { status, text } = MESSAGES[result.reason];
    return jsonError(status, result.reason, text);
  }

  return Response.json({
    // Не връщаме целия номер обратно — само края, за да е ясно къде е отишъл кодът.
    phoneSuffix: result.phone.slice(-4),
    expiresAt: result.expiresAt.toISOString(),
  });
}
