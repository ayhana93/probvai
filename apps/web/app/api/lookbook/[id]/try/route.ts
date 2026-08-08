import { buildKey, getObject, putObject } from '@probvai/core';
import { dbSystem } from '@probvai/db';
import { jsonError, requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/lookbook/{id}/try  →  { garmentKey }
 *
 * „✨ Пробвай този аутфит" — взима ДРЕХАТА от чужда публикувана визия и я
 * подготвя за собствена проба.
 *
 * ═══ ЗАЩО СЕ КОПИРА, А НЕ СЕ ПОЛЗВА ЧУЖДИЯТ КЛЮЧ ═══
 *
 * Правилото „ключът трябва да е на този потребител" е това, което пази
 * човек да не пробва дреха върху чужда снимка. То не се разхлабва заради
 * една функция.
 *
 * Затова снимката на дрехата се копира в неговия собствен префикс и оттам
 * нататък всичко върви по обикновения път — `startGeneration` не знае, че
 * дрехата е дошла от галерията, и не му трябва да знае.
 *
 * ═══ КАКВО НЕ СЕ КОПИРА ═══
 *
 * Снимката на ЧОВЕКА от чуждата визия. Тя не се докосва и не напуска своя
 * притежател. Копира се дрехата, и само тя.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await requireUser();
  if (session.response) return session.response;

  const { id } = await context.params;

  const look = await dbSystem().generation.findUnique({
    where: { id },
    select: { publishedAt: true, garmentKey: true, merchant: true, category: true },
  });

  if (!look?.publishedAt || !look.garmentKey) {
    // 404, а не 403: непубликувана визия не бива да се потвърждава,
    // че съществува.
    return jsonError(404, 'NOT_FOUND', 'Няма такава визия.');
  }

  try {
    const bytes = await getObject(look.garmentKey);
    const extension = look.garmentKey.split('.').pop() ?? 'jpg';
    const key = buildKey(session.user.id, 'garment', extension);

    await putObject(key, bytes, `image/${extension === 'png' ? 'png' : 'jpeg'}`);

    return Response.json({ garmentKey: key, category: look.category });
  } catch (error) {
    console.error('[lookbook] дрехата не се копира:', error);
    return jsonError(502, 'COPY_FAILED', 'Не се получи. Пробвай пак след малко.');
  }
}
