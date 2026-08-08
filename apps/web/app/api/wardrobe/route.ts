import { getSignedUrl, isStyleCategory } from '@probvai/core';
import { dbAsUser } from '@probvai/db';
import { requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/wardrobe?category= — гардеробът.
 *
 * Чете през `dbAsUser`, тоест през Row Level Security: базата, а не кодът,
 * гарантира, че се връщат само неговите проби. Затова тук няма `where`
 * с `userId` — липсата му не е пропуск, а точката на цялата защита.
 *
 * ═══ ИМЕТО НА МАГАЗИНА ═══
 *
 * Показва се САМО когато пробата е направена от линк. При качена снимка
 * нямаме откъде да знаем от кой магазин е дрехата — а измислено име е
 * по-лошо от липсващо.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await requireUser();
  if (session.response) return session.response;

  const raw = new URL(request.url).searchParams.get('category');
  const category = isStyleCategory(raw) ? raw : null;

  const generations = await dbAsUser(session.user.id).generation.findMany({
    where: {
      status: 'DONE',
      resultKey: { not: null },
      ...(category ? { category } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 120,
    select: {
      id: true,
      resultKey: true,
      source: true,
      merchant: true,
      category: true,
      watermarked: true,
      savedAt: true,
      publishedAt: true,
      createdAt: true,
    },
  });

  const items = await Promise.all(
    generations.map(async (generation) => ({
      id: generation.id,
      url: await getSignedUrl(generation.resultKey!),
      // Правилото се вижда и тук, на изхода, не само при записа.
      merchant: generation.source === 'LINK' ? generation.merchant : null,
      category: generation.category,
      watermarked: generation.watermarked,
      saved: generation.savedAt !== null,
      published: generation.publishedAt !== null,
      createdAt: generation.createdAt.toISOString(),
    })),
  );

  return Response.json({ items }, { headers: { 'cache-control': 'no-store' } });
}
