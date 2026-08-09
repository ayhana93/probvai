import { getSignedUrl } from '@probvai/core';
import { dbAsUser } from '@probvai/db';
import { jsonError, requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/me/avatar — профилната снимка на влезлия човек.
 *
 * Отделна от `/api/me/snimka`, защото са две различни снимки: тази е лицето
 * в кръгчето, другата е тялото, върху което пробваме дрехи.
 *
 * Ключът не напуска сървъра — интерфейсът иска „моята профилна снимка", а не
 * файл `eb3f9c…`.
 */
export async function GET(): Promise<Response> {
  const session = await requireUser();
  if (session.response) return session.response;

  const me = await dbAsUser(session.user.id).user.findUnique({
    where: { id: session.user.id },
    select: { avatarKey: true },
  });

  if (!me?.avatarKey) {
    return jsonError(404, 'NO_AVATAR', 'Още няма профилна снимка.');
  }

  return Response.redirect(await getSignedUrl(me.avatarKey), 302);
}
