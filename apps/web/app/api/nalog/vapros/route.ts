import { questionForEmail } from '@probvai/core';
import { jsonError, readJson } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/nalog/vapros — тайният въпрос за даден имейл.
 *
 * ═══ ЗАЩО ВИНАГИ ВРЪЩА ВЪПРОС ═══
 *
 * И за непознат имейл. Ако отговаряше „няма такъв профил", този адрес щеше
 * да е безплатна проверка кой има акаунт при нас — подаваш списък имейли и
 * записваш кои минават.
 *
 * За непознат адрес въпросът се избира по хеш на самия адрес, значи е един
 * и същ при всяко питане. Променлив въпрос би издал измамата веднага.
 * Отговорът после просто не съвпада с нищо.
 *
 * POST, а не GET: имейлът не бива да влиза в адреса и оттам в логовете на
 * сървъра и в историята на браузъра.
 */
type Body = { email?: unknown };

export async function POST(request: Request): Promise<Response> {
  const body = await readJson<Body>(request);
  const found = await questionForEmail(body?.email);

  if (!found) {
    return jsonError(400, 'BAD_EMAIL', 'Напиши имейла си.');
  }

  return Response.json(found, { headers: { 'cache-control': 'no-store' } });
}
