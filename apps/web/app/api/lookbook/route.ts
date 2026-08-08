import { isStyleCategory, lookbookFeed, newSeed, PAGE_SIZE } from '@probvai/core';
import { requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/lookbook?seed=&cursor=&category=
 *
 * Една страница от публичната галерия.
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
  const session = await requireUser();
  if (session.response) return session.response;

  const url = new URL(request.url);
  const seed = url.searchParams.get('seed') || newSeed();
  const cursor = url.searchParams.get('cursor');
  const rawCategory = url.searchParams.get('category');

  const page = await lookbookFeed({
    viewerId: session.user.id,
    seed,
    cursor,
    category: isStyleCategory(rawCategory) ? rawCategory : null,
    limit: PAGE_SIZE,
  });

  return Response.json(
    {
      seed: page.seed,
      nextCursor: page.nextCursor,
      items: page.items.map((item) => ({
        id: item.id,
        category: item.category,
        likeCount: item.likeCount,
        liked: item.liked,
        saved: item.saved,
        mine: item.mine,
      })),
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
