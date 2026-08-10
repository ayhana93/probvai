import { env, getSignedUrl, isStyleCategory, likedLooks } from '@probvai/core';
import { dbAsUser } from '@probvai/db';
import { requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Item = {
  id: string;
  url: string;
  merchant: string | null;
  category: string | null;
  watermarked: boolean;
  saved: boolean;
  favorited: boolean;
  published: boolean;
  /** Моя проба ли е. Чуждите идват от харесаните в Lookbook. */
  mine: boolean;
  createdAt: string;
};

/**
 * GET /api/wardrobe?category=&favorite=1 — гардеробът.
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
 *
 * ═══ „ЛЮБИМИ" СЪБИРА ДВЕ НЕЩА ═══
 *
 * Сърцето значи едно и също, където и да е натиснато: върху своя проба и
 * върху чужда визия в Lookbook. Затова филтърът връща и двете.
 *
 * Чуждите минават по ДРУГ път — `likedLooks`, през системната роля, с
 * изрично изброени колони. Ключът им в R2 не напуска сървъра: снимката се
 * тегли през `/api/lookbook/{id}/image`, който сам проверява, че визията
 * още е публикувана. Свали ли я собственикът, тя изчезва и оттук.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await requireUser();
  if (session.response) return session.response;

  const params = new URL(request.url).searchParams;
  const raw = params.get('category');
  const category = isStyleCategory(raw) ? raw : null;

  // „Любими" е филтър наравно с категориите, не отделен екран: те са едно и
  // също нещо за човека — начин да види по-малко наведнъж.
  const onlyFavorites = params.get('favorite') === '1';

  const generations = await dbAsUser(session.user.id).generation.findMany({
    where: {
      status: 'DONE',
      resultKey: { not: null },
      ...(category ? { category } : {}),
      ...(onlyFavorites ? { favoritedAt: { not: null } } : {}),
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
      favoritedAt: true,
      publishedAt: true,
      createdAt: true,
    },
  });

  const items: Item[] = await Promise.all(
    generations.map(async (generation) => ({
      id: generation.id,
      url: await getSignedUrl(generation.resultKey!),
      // Правилото се вижда и тук, на изхода, не само при записа.
      merchant: generation.source === 'LINK' ? generation.merchant : null,
      category: generation.category,
      watermarked: generation.watermarked,
      saved: generation.savedAt !== null,
      favorited: generation.favoritedAt !== null,
      published: generation.publishedAt !== null,
      mine: true,
      createdAt: generation.createdAt.toISOString(),
    })),
  );

  /**
   * Чуждите харесани визии влизат само докато галерията се показва.
   *
   * Иначе „Любими" щеше да е единственото място, където чуждо съдържание
   * оцелява след скриването на Lookbook — и хем неочаквано, хем без път
   * назад към мястото, откъдето е дошло.
   */
  if (onlyFavorites && env.LOOKBOOK_ENABLED) {
    const liked = await likedLooks(session.user.id);

    for (const look of liked) {
      // Категорията се спазва и за чуждите — иначе филтърът „Лято" би
      // показвал зимни визии само защото са харесани.
      if (category && look.category !== category) continue;

      items.push({
        id: look.id,
        url: `/api/lookbook/${look.id}/image`,
        merchant: null,
        category: look.category,
        watermarked: false,
        saved: false,
        favorited: true,
        published: true,
        mine: false,
        createdAt: look.likedAt.toISOString(),
      });
    }

    // Едно подреждане за двата източника. Иначе чуждите щяха да стоят на
    // едно и също място най-отдолу, независимо кога са харесани.
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  return Response.json({ items }, { headers: { 'cache-control': 'no-store' } });
}
