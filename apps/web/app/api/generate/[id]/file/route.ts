import { getObject } from '@probvai/core';
import { dbAsUser } from '@probvai/db';
import { jsonError, requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/generate/{id}/file — готовата проба, както е.
 *
 * ═══ ЗАЩО СЪЩЕСТВУВА, КАТО ИМА ПОДПИСАН АДРЕС ═══
 *
 * „Запази в галерията" сваляше снимката с `fetch` по подписания адрес на R2.
 * Това е ДРУГ домейн, а R2 не праща `Access-Control-Allow-Origin` — заявката
 * умираше в CORS и на екрана пишеше „Не се свали. Пробвай пак."
 *
 * Показването работеше, защото `<img src>` не минава през CORS. Затова
 * счупено беше само свалянето и изглеждаше като случайна грешка.
 *
 * Тук снимката излиза от НАШИЯ домейн. Няма CORS, няма какво да се настройва
 * в кофата и правилото „обектите са частни" остава.
 *
 * ═══ ЗАЩО НЕ `/share` ═══
 *
 * Онзи адрес връща картинка 1080×1920 за Story — с полета и подложка. За
 * галерията се иска самата проба, не форматът за Instagram.
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

  const image = await getObject(generation.resultKey);

  return new Response(new Uint8Array(image), {
    headers: {
      'content-type': 'image/jpeg',
      'content-disposition': `attachment; filename="probvai-${id}.jpg"`,
      // Готовата проба не се променя. Личната кеш-памет на браузъра е
      // достатъчна; през общи кешове не бива да минава.
      'cache-control': 'private, max-age=86400',
    },
  });
}
