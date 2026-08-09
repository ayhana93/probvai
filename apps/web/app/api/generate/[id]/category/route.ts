import { isStyleCategory } from '@probvai/core';
import { dbAsUser } from '@probvai/db';
import { jsonError, readJson, requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/generate/{id}/category — смяна на стиловата категория.
 *
 * Категорията се слага автоматично след генерацията. Тук човекът я
 * поправя — и с това я ЗАКЛЮЧВА: `category_locked` спира автоматиката да
 * я върне обратно при следваща обработка. Неговият избор бие нашето
 * предположение, и то завинаги, а не до следващия път.
 */
type Body = { category?: unknown };

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await requireUser();
  if (session.response) return session.response;

  const body = await readJson<Body>(request);
  if (!body || !isStyleCategory(body.category)) {
    return jsonError(400, 'BAD_CATEGORY', 'Няма такава категория.');
  }

  const { id } = await context.params;
  const db = dbAsUser(session.user.id);

  const generation = await db.generation.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!generation) {
    return jsonError(404, 'NOT_FOUND', 'Няма такава проба.');
  }

  await db.generation.update({
    where: { id },
    data: { category: body.category, categoryLocked: true },
  });

  return Response.json({ ok: true, category: body.category });
}
