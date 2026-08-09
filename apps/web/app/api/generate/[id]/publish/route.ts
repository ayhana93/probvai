import { setPublished, type PublishFailure } from '@probvai/core';
import { jsonError, readJson, requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/generate/{id}/publish — слага или маха визия от Lookbook.
 *
 * Публикува се ЕДНА визия с изрично действие. Публичният гардероб от
 * регистрацията дава само правото; той не публикува нищо сам. Разликата е
 * съществена: снимка с лице излиза навън, защото човек е натиснал копче
 * за нея, а не защото е сложил отметка преди месец.
 */

const MESSAGES: Record<PublishFailure, { status: number; text: string }> = {
  NOT_FOUND: { status: 404, text: 'Няма такава проба.' },
  NOT_DONE: { status: 409, text: 'Пробата още не е готова.' },
  WARDROBE_PRIVATE: {
    status: 403,
    text: 'Гардеробът ти е личен. Включи публичния от настройките.',
  },
  NOT_ALLOWED: { status: 403, text: 'Това не може.' },
};

type Body = { published?: unknown };

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await requireUser();
  if (session.response) return session.response;

  const body = await readJson<Body>(request);
  const published = body?.published !== false;

  const { id } = await context.params;
  const result = await setPublished(session.user.id, id, published);

  if (!result.ok) {
    const { status, text } = MESSAGES[result.reason];
    return jsonError(status, result.reason, text);
  }

  return Response.json({ ok: true, published: result.published });
}
