import { destroySession } from '@/lib/session-cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/nalog/izhod — излизане.
 *
 * Само POST. Излизане по GET значи, че чужд сайт може да те изхвърли с
 * едно `<img src="...">` — дребна злоба, но безплатна за нападателя.
 */
export async function POST(): Promise<Response> {
  await destroySession();
  return Response.json({ ok: true });
}
