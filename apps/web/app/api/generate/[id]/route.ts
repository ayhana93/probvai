import { loadGenerationView, messageForError } from '@/lib/generation-view';
import { jsonError, requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/generate/{id} — състоянието на една генерация. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await requireUser();
  if (session.response) return session.response;

  const { id } = await context.params;
  const view = await loadGenerationView(session.user.id, id);

  if (!view) {
    return jsonError(404, 'NOT_FOUND', 'Няма такава проба.');
  }

  return Response.json(
    { ...view, errorMessage: messageForError(view.errorCode) },
    { headers: { 'cache-control': 'no-store' } },
  );
}
