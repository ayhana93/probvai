import { toggleLike } from '@probvai/core';
import { jsonError, requireUser } from '@/lib/session';
import { lookbookClosed } from '@/lib/lookbook-gate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/lookbook/{id}/like — харесва или отхаресва.
 *
 * Едно натискане обръща състоянието. Няма отделен endpoint за махане —
 * два endpoint-а за едно копче водят до състояния, които се разминават.
 *
 * Известия за харесване няма. Известието иска профил, който да го получи,
 * и адресат, който да бъде разпознат — а тук няма профили. Числото под
 * визията върши същата работа, без да превръща галерията в социална мрежа.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const closed = lookbookClosed();
  if (closed) return closed;

  const session = await requireUser();
  if (session.response) return session.response;

  const { id } = await context.params;
  const result = await toggleLike(session.user.id, id);

  if (!result.ok) {
    if (result.reason === 'OWN_LOOK') {
      return jsonError(409, 'OWN_LOOK', 'Своята визия не се харесва.');
    }
    return jsonError(404, 'NOT_FOUND', 'Няма такава визия.');
  }

  return Response.json({ liked: result.on, likeCount: result.likeCount });
}
