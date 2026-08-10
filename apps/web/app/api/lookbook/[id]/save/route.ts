import { toggleSave } from '@probvai/core';
import { jsonError, requireUser } from '@/lib/session';
import { lookbookClosed } from '@/lib/lookbook-gate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/lookbook/{id}/save — слага или маха чужда визия от „Запазени".
 *
 * Запазването е отметка, не копие. Снимката остава на своя собственик и
 * изчезва от запазените, ако той я махне от галерията.
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
  const result = await toggleSave(session.user.id, id);

  if (!result.ok) {
    return jsonError(404, 'NOT_FOUND', 'Няма такава визия.');
  }

  return Response.json({ saved: result.on });
}
