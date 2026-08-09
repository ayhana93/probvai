import { dbAsUser } from '@probvai/db';
import { jsonError, readJson, requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/generate/{id}/favorite — слага или маха „любима".
 *
 * ═══ ЗАЩО ПРЕЗ `dbAsUser` ═══
 *
 * Пише се през ролята на потребителя, значи през Row Level Security и през
 * правата на колона: `app_user` има UPDATE само върху `favorited_at` (виж
 * миграцията). Дори тази заявка да бъде подведена с чуждо id, базата няма
 * какво да ѝ даде — политиката не вижда чуждия ред.
 *
 * ═══ ЗАЩО НЕ Е `saved_at` ═══
 *
 * `saved_at` значи „свалена в галерията на телефона" — събитие, не
 * предпочитание. Човек сваля и визии, които после не му харесват.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await requireUser();
  if (session.response) return session.response;

  const { id } = await context.params;
  const body = await readJson<{ favorited?: unknown }>(request);
  const favorited = body?.favorited === true;

  const updated = await dbAsUser(session.user.id).generation.updateMany({
    where: { id },
    data: { favoritedAt: favorited ? new Date() : null },
  });

  if (updated.count === 0) {
    return jsonError(404, 'NOT_FOUND', 'Няма такава проба.');
  }

  return Response.json({ favorited });
}
