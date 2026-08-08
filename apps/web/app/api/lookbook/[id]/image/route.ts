import { publicLookImageUrl } from '@probvai/core';
import { jsonError, requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/lookbook/{id}/image — снимката на публикувана визия.
 *
 * Отделен път от `/api/images/...` нарочно. Онзи пуска само собствени
 * ключове и проверката му е по префикса; този пуска чужди, но САМО ако
 * визията е публикувана — и не издава ключа в R2 на никого.
 *
 * Махне ли собственикът визията от галерията, адресът спира да работи още
 * при следващото зареждане.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await requireUser();
  if (session.response) return session.response;

  const { id } = await context.params;
  const url = await publicLookImageUrl(id);

  if (!url) {
    // 404, а не 403: непубликувана визия не бива да се потвърждава,
    // че съществува.
    return jsonError(404, 'NOT_FOUND', 'Няма такава визия.');
  }

  return Response.redirect(url, 302);
}
