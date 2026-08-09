import { clearResetAttempts, verifyCredentials } from '@probvai/core';
import { createSession } from '@/lib/session-cookie';
import { jsonError, readJson } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/nalog/vhod — вход с имейл и парола.
 *
 * ═══ ЕДНО СЪОБЩЕНИЕ ЗА ДВЕ РАЗЛИЧНИ ГРЕШКИ ═══
 *
 * Сгрешен имейл и сгрешена парола дават едно и също: „Имейлът или паролата
 * не съвпадат." Разделим ли ги, формата за вход става проверка кой има
 * профил при нас — с един списък адреси всеки може да го изкара.
 *
 * Времето за отговор също е изравнено; това е работа на `verifyCredentials`.
 */
type Body = { email?: unknown; password?: unknown };

export async function POST(request: Request): Promise<Response> {
  const body = await readJson<Body>(request);
  if (!body) {
    return jsonError(400, 'BAD_REQUEST', 'Заявката не е правилно оформена.');
  }

  const result = await verifyCredentials(body.email, body.password);

  if (!result.ok) {
    if (result.reason === 'SUSPENDED') {
      return jsonError(403, 'SUSPENDED', 'Профилът ти е спрян. Пиши ни.');
    }
    return jsonError(401, 'BAD_CREDENTIALS', 'Имейлът или паролата не съвпадат.');
  }

  await createSession(result.userId);
  // Човекът явно си е спомнил паролата — броячът на опитите за
  // възстановяване няма какво повече да пази.
  await clearResetAttempts(result.userId);

  return Response.json({ ok: true });
}
