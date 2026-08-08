import { dbAsUser } from '@probvai/db';
import { jsonError, requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/generate/{id}/save
 *
 * Отбелязва, че визията е свалена в галерията на телефона.
 *
 * ═══ КАКВО СЕ СЛУЧВА С ГАРДЕРОБА ═══
 *
 * Нищо — визията вече е там. Всяка готова проба влиза в гардероба сама,
 * защото гардероб, от който нещо може да липсва, не е гардероб.
 *
 * Тази отметка казва друго: „тази вече я имам и на телефона си". Служи за
 * знака в ъгъла на плочката и за подредбата. Ако се броеше за влизане в
 * гардероба, човек, който забрави да натисне копчето, щеше да загуби
 * снимката — а той е платил за нея.
 *
 * Пише се през `dbAsUser`: базата, а не кодът, гарантира, че се отбелязва
 * чужда снимка. Ролята `app_user` има UPDATE точно върху `saved_at` и
 * върху нищо друго от този ред.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await requireUser();
  if (session.response) return session.response;

  const { id } = await context.params;
  const db = dbAsUser(session.user.id);

  const generation = await db.generation.findUnique({
    where: { id },
    select: { status: true, resultKey: true, savedAt: true },
  });

  if (!generation) {
    return jsonError(404, 'NOT_FOUND', 'Няма такава проба.');
  }
  if (generation.status !== 'DONE' || !generation.resultKey) {
    return jsonError(409, 'NOT_DONE', 'Пробата още не е готова.');
  }

  // Повторно натискане не мести датата. Първото сваляне е това, което
  // има значение.
  if (!generation.savedAt) {
    await db.generation.update({ where: { id }, data: { savedAt: new Date() } });
  }

  return Response.json({ ok: true, saved: true });
}
