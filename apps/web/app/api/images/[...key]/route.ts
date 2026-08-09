import { getSignedUrl, keyBelongsTo } from '@probvai/core';
import { jsonError, requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/images/users/{userId}/{kind}/{файл}
 *
 * Обектите в R2 са частни. Тук проверяваме, че ключът е на влезлия
 * потребител, и пренасочваме към подписан адрес с кратък живот.
 *
 * Проверката е по префикса на ключа — схемата `users/{userId}/...` прави
 * притежанието видимо от самия ключ.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> },
): Promise<Response> {
  const session = await requireUser();
  if (session.response) return session.response;

  const { key: segments } = await context.params;
  const key = segments.map((part) => decodeURIComponent(part)).join('/');

  if (!keyBelongsTo(key, session.user.id)) {
    // Нарочно 404, а не 403: чужд ключ не бива да се потвърждава, че съществува.
    return jsonError(404, 'NOT_FOUND', 'Няма такъв файл.');
  }

  const url = await getSignedUrl(key);

  return Response.redirect(url, 302);
}
