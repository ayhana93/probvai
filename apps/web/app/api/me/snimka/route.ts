import { getSignedUrl } from '@probvai/core';
import { dbAsUser } from '@probvai/db';
import { jsonError, requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/me/snimka — снимката по подразбиране на влезлия човек.
 *
 * Отделен адрес, а не ключът към R2 през `/api/images/...`. Разликата е, че
 * тук ключът изобщо не напуска сървъра: интерфейсът иска „моята снимка", а
 * не „файл eb3f9c…". Един адрес по-малко, който да се пази.
 *
 * Чете се през `dbAsUser`, значи през Row Level Security.
 */
export async function GET(): Promise<Response> {
  const session = await requireUser();
  if (session.response) return session.response;

  const me = await dbAsUser(session.user.id).user.findUnique({
    where: { id: session.user.id },
    select: { defaultPhotoKey: true },
  });

  if (!me?.defaultPhotoKey) {
    return jsonError(404, 'NO_PHOTO', 'Още няма снимка.');
  }

  return Response.redirect(await getSignedUrl(me.defaultPhotoKey), 302);
}
