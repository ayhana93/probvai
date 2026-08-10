import {
  isStyleCategory,
  lookbookFeed,
  looksPublishedAfter,
  newSeed,
  PAGE_SIZE,
} from '@probvai/core';
import { requireUser } from '@/lib/session';
import { lookbookClosed } from '@/lib/lookbook-gate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/lookbook?seed=&cursor=&category=
 * GET /api/lookbook?since=&category=
 *
 * Една страница от публичната галерия — или само публикуваното след даден
 * момент.
 *
 * ═══ ЗАЩО ДВЕТЕ СА НА ЕДИН АДРЕС ═══
 *
 * Отговорът е един и същ по форма: визии, които този човек има право да види,
 * с еднакви полета. Различна е само подредбата — веднъж разбъркана, веднъж по
 * време. Втори адрес би значел втора проверка на сесията и втори списък с
 * колони, който рано или късно се разминава с първия.
 *
 * ═══ ЗАЩО ИМА „СЕМЕ" ═══
 *
 * Подредбата е на случаен принцип, но трябва да е СТАБИЛНА, докато човекът
 * скролва. При `ORDER BY random()` всяка следваща страница се пренарежда:
 * една визия излиза три пъти, друга не излиза изобщо.
 *
 * Затова първата заявка идва без семе, сървърът прави ново и го връща;
 * следващите го подават обратно. Ново отваряне на екрана значи ново семе,
 * значи нова подредба.
 */
export async function GET(request: Request): Promise<Response> {
  const closed = lookbookClosed();
  if (closed) return closed;

  const session = await requireUser();
  if (session.response) return session.response;

  const url = new URL(request.url);
  const rawCategory = url.searchParams.get('category');
  const category = isStyleCategory(rawCategory) ? rawCategory : null;
  const rawSince = url.searchParams.get('since');

  const shape = (page: {
    items: { id: string; category: unknown; likeCount: number; liked: boolean; saved: boolean; mine: boolean }[];
    nextCursor?: string | null;
    seed?: string;
    newest: string | null;
  }) => ({
    seed: page.seed ?? null,
    nextCursor: page.nextCursor ?? null,
    newest: page.newest,
    items: page.items.map((item) => ({
      id: item.id,
      category: item.category,
      likeCount: item.likeCount,
      liked: item.liked,
      saved: item.saved,
      mine: item.mine,
    })),
  });

  // ── Само новото ──────────────────────────────────────────────────────────
  if (rawSince) {
    const since = new Date(rawSince);
    // Негодна дата не бива да мине за „началото на времето" — това би
    // върнало цялата галерия под името „нови визии".
    if (Number.isNaN(since.getTime())) {
      return Response.json(
        { seed: null, nextCursor: null, newest: null, items: [] },
        { headers: { 'cache-control': 'no-store' } },
      );
    }

    const page = await looksPublishedAfter({
      viewerId: session.user.id,
      since,
      category,
      limit: PAGE_SIZE,
    });

    return Response.json(shape(page), { headers: { 'cache-control': 'no-store' } });
  }

  // ── Обикновена страница ──────────────────────────────────────────────────
  const page = await lookbookFeed({
    viewerId: session.user.id,
    seed: url.searchParams.get('seed') || newSeed(),
    cursor: url.searchParams.get('cursor'),
    category,
    limit: PAGE_SIZE,
  });

  return Response.json(shape(page), { headers: { 'cache-control': 'no-store' } });
}
