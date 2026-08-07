import { buildShareImage, getObject } from '@probvai/core';
import { dbAsUser } from '@probvai/db';
import { jsonError, requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/generate/{id}/share — картинка 1080×1920 за Story.
 *
 * Прави се при поискване, не при генериране. Повечето проби никога не се
 * споделят — да ги правим всичките предварително значи да плащаме за
 * обработка и за място, които в осем от десет случая не трябват.
 *
 * Четенето минава през `dbAsUser`, значи през Row Level Security: чужда
 * генерация не се вижда, дори id-то да е познато.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await requireUser();
  if (session.response) return session.response;

  const { id } = await context.params;

  const generation = await dbAsUser(session.user.id).generation.findUnique({
    where: { id },
    select: { resultKey: true, status: true },
  });

  if (!generation?.resultKey || generation.status !== 'DONE') {
    return jsonError(404, 'NOT_READY', 'Тази проба още не е готова.');
  }

  const result = await getObject(generation.resultKey);
  const story = await buildShareImage(result);

  return new Response(new Uint8Array(story), {
    headers: {
      'content-type': 'image/jpeg',
      'content-disposition': `inline; filename="probvai-${id}.jpg"`,
      // Готовата проба не се променя — може да се кешира дълго в браузъра.
      'cache-control': 'private, max-age=86400',
    },
  });
}
