import { dbAsUser } from '@probvai/db';
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

/**
 * DELETE /api/generate/{id} — маха проба от гардероба.
 *
 * Изтрива се редът; файлът в R2 се чисти от нощната задача на Фаза 8.
 * Причината да не се трие веднага: изтриването на файл може да се провали,
 * а тогава редът щеше да остане и снимката щеше да се появи пак.
 *
 * `dbAsUser` значи, че чужда проба не може да се изтрие дори при познато
 * id — политиката не вижда реда и няма какво да изтрие.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await requireUser();
  if (session.response) return session.response;

  const { id } = await context.params;
  const removed = await dbAsUser(session.user.id).generation.deleteMany({
    where: { id },
  });

  if (removed.count === 0) {
    return jsonError(404, 'NOT_FOUND', 'Няма такава проба.');
  }

  return Response.json({ ok: true });
}
