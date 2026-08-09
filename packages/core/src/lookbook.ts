/**
 * LOOKBOOK — публичната галерия.
 *
 * ═══ КАКВО НЕ Е ═══
 *
 * Няма социална мрежа. Няма профили. Няма последователи. Няма чат. Няма
 * коментари. Това не е липса на функции, а решение: щом има коментари, трябва
 * да има модерация, доклади, блокиране и човек, който ги чете. Галерия с
 * красиви визии върши работата, за която е — да покаже какво може да се
 * направи — и не носи нищо от това.
 *
 * Затова под всяка визия има точно три неща:
 *   ❤️  Харесай
 *   ⭐  Запази
 *   ✨  Пробвай този аутфит
 *
 * Третото е важното: то връща човека в потока за генериране и харчи кредит.
 * Останалите две го задържат в галерията.
 *
 * ═══ ЗАЩО ВСИЧКО ТУК МИНАВА ПРЕЗ СИСТЕМНАТА РОЛЯ ═══
 *
 * Row Level Security реже чуждите редове — точно както трябва. Галерията
 * обаче по определение показва чужди редове. Изкушението е политика
 * „чети всички публикувани", но правата в Postgres са на колона и таблица,
 * не на политика: такава политика би отворила и `person_key`, и `cost_usd`,
 * и `provider_job_id`.
 *
 * Затова: един файл, една роля, изрично изброени колони. Един одитиран път
 * се проверява по-лесно от една широка политика.
 */

import { dbSystem, Prisma, type StyleCategory } from '@probvai/db';
import { getSignedUrl } from './storage';

/** Колко визии идват наведнъж при безкрайното скролване. */
export const PAGE_SIZE = 12;

export type LookItem = {
  id: string;
  category: StyleCategory | null;
  likeCount: number;
  /** Харесал ли я е този, който гледа. */
  liked: boolean;
  /** Запазил ли я е. */
  saved: boolean;
  /** Моя ли е — тогава не си я харесваме сами. */
  mine: boolean;
  createdAt: Date;
  /** Курсорът за следващата страница. */
  cursor: string;
};

export type LookPage = {
  items: LookItem[];
  /** Подава се обратно при следващото искане. `null` значи край. */
  nextCursor: string | null;
  /** Семето на подредбата — трябва да е същото за цялото скролване. */
  seed: string;
  /**
   * Кога е публикувана НАЙ-НОВАТА визия в галерията в този миг.
   *
   * ═══ ЗА КАКВО СЛУЖИ ═══
   *
   * Екранът пита през равни промеждутъци „има ли нещо ново". За да е този
   * въпрос честен, трябва котва — момент, след който всичко е ново.
   *
   * Не става да е най-новото от ПОКАЗАНИТЕ визии: подредбата е случайна и
   * първата страница е дванайсет визии от хиляда. Най-новата почти никога не
   * е сред тях, и екранът щеше да обявява за „нови" стари визии, които просто
   * не е заредил. Затова котвата идва от цялата галерия, не от страницата.
   *
   * Смята се само за първата страница — следващите не я ползват.
   */
  newest: string | null;
};

/**
 * Прави ново семе за подредбата.
 *
 * ═══ ЗАЩО „НА СЛУЧАЕН ПРИНЦИП" НЕ Е `ORDER BY random()` ═══
 *
 * При `random()` всяка следваща страница се пренарежда наново: една и съща
 * визия излиза три пъти, а друга не излиза изобщо. Скролването се разпада.
 *
 * Вместо това подреждаме по `md5(id || семе)`. Резултатът е също толкова
 * разбъркан, но е СТАБИЛЕН, докато семето не се смени — а то се сменя при
 * всяко ново отваряне на екрана. Значи: различна подредба всеки път,
 * без повторения в рамките на едно разглеждане.
 */
export function newSeed(): string {
  return crypto.randomUUID();
}

type FeedRow = {
  id: string;
  category: StyleCategory | null;
  like_count: number;
  created_at: Date;
  user_id: string;
  ord: string;
  liked: boolean;
  saved: boolean;
};

export type FeedOptions = {
  viewerId: string;
  seed: string;
  cursor?: string | null;
  category?: StyleCategory | null;
  limit?: number;
};

/** Една страница от галерията. */
export async function lookbookFeed(options: FeedOptions): Promise<LookPage> {
  const limit = Math.min(Math.max(options.limit ?? PAGE_SIZE, 1), 40);
  const cursor = options.cursor ?? '';
  const category = options.category ?? null;

  const rows = await dbSystem().$queryRaw<FeedRow[]>`
    SELECT
      g.id,
      g.category,
      g.like_count,
      g.created_at,
      g.user_id,
      md5(g.id || ${options.seed}) AS ord,
      EXISTS (
        SELECT 1 FROM look_likes l
        WHERE l.generation_id = g.id AND l.user_id = ${options.viewerId}
      ) AS liked,
      EXISTS (
        SELECT 1 FROM look_saves s
        WHERE s.generation_id = g.id AND s.user_id = ${options.viewerId}
      ) AS saved
    FROM generations g
    WHERE g.published_at IS NOT NULL
      AND g.status = 'DONE'
      AND g.result_key IS NOT NULL
      AND (${category}::"StyleCategory" IS NULL OR g.category = ${category}::"StyleCategory")
      AND md5(g.id || ${options.seed}) > ${cursor}
    ORDER BY md5(g.id || ${options.seed})
    LIMIT ${limit}
  `;

  const items: LookItem[] = rows.map((row) => ({
    id: row.id,
    category: row.category,
    likeCount: row.like_count,
    liked: row.liked,
    saved: row.saved,
    mine: row.user_id === options.viewerId,
    createdAt: row.created_at,
    cursor: row.ord,
  }));

  return {
    items,
    // По-малко от исканото значи, че сме на дъното.
    nextCursor: items.length < limit ? null : (items.at(-1)?.cursor ?? null),
    seed: options.seed,
    /**
     * Само при първата страница — следващите не я ползват, а заявката не е
     * безплатна.
     *
     * Празна галерия също дава котва: часът на СЪРВЪРА в този миг. Часовникът
     * на телефона може да бърза с минути и тогава първите публикувани визии
     * биха останали „стари", преди изобщо да са се появили.
     */
    newest:
      cursor === ''
        ? ((await newestPublishedAt(category)) ?? new Date().toISOString())
        : null,
  };
}

/** Кога е публикувана най-новата визия в галерията (в дадена категория). */
async function newestPublishedAt(category: StyleCategory | null): Promise<string | null> {
  const result = await dbSystem().generation.aggregate({
    where: {
      publishedAt: { not: null },
      status: 'DONE',
      resultKey: { not: null },
      ...(category ? { category } : {}),
    },
    _max: { publishedAt: true },
  });

  return result._max.publishedAt?.toISOString() ?? null;
}

/**
 * ВИЗИИТЕ, ПУБЛИКУВАНИ СЛЕД ДАДЕН МОМЕНТ.
 *
 * ═══ ЗАЩО НЕ Е ПАК `lookbookFeed` ═══
 *
 * Екранът питаше за първа страница с ново семе и смяташе за „нови" всички
 * непознати. При двайсет визии това горе-долу работи. При хиляда всяка такава
 * проверка връща дванайсет случайни, почти всички непознати — и списъкът
 * растеше на всеки петнайсет секунди със СТАРО съдържание, а копчето обявяваше
 * „12 нови визии", без някой да е публикувал каквото и да е.
 *
 * Тук подредбата не е случайна, а по време на публикуване. „Ново" значи ново.
 */
export async function looksPublishedAfter(options: {
  viewerId: string;
  since: Date;
  category?: StyleCategory | null;
  limit?: number;
}): Promise<{ items: LookItem[]; newest: string | null }> {
  const limit = Math.min(Math.max(options.limit ?? PAGE_SIZE, 1), 40);
  const category = options.category ?? null;

  const rows = await dbSystem().generation.findMany({
    where: {
      publishedAt: { gt: options.since },
      status: 'DONE',
      resultKey: { not: null },
      ...(category ? { category } : {}),
    },
    orderBy: { publishedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      category: true,
      likeCount: true,
      createdAt: true,
      publishedAt: true,
      userId: true,
    },
  });

  if (rows.length === 0) return { items: [], newest: null };

  const ids = rows.map((row) => row.id);
  const [likes, saves] = await Promise.all([
    dbSystem().lookLike.findMany({
      where: { userId: options.viewerId, generationId: { in: ids } },
      select: { generationId: true },
    }),
    dbSystem().lookSave.findMany({
      where: { userId: options.viewerId, generationId: { in: ids } },
      select: { generationId: true },
    }),
  ]);

  const liked = new Set(likes.map((like) => like.generationId));
  const saved = new Set(saves.map((save) => save.generationId));

  return {
    items: rows.map((row) => ({
      id: row.id,
      category: row.category,
      likeCount: row.likeCount,
      liked: liked.has(row.id),
      saved: saved.has(row.id),
      mine: row.userId === options.viewerId,
      createdAt: row.createdAt,
      // Курсорът тук е без значение: този списък не се листва.
      cursor: '',
    })),
    newest: rows[0]?.publishedAt?.toISOString() ?? null,
  };
}

// ---------------------------------------------------------------------------
// Публикуване
// ---------------------------------------------------------------------------

export type PublishFailure =
  | 'NOT_FOUND'
  | 'NOT_DONE'
  | 'WARDROBE_PRIVATE'
  | 'NOT_ALLOWED';

export type PublishResult =
  | { ok: true; published: boolean }
  | { ok: false; reason: PublishFailure };

/**
 * Слага или маха визия от галерията.
 *
 * Публикува се ЕДНА визия, не целият гардероб. Дори при публичен гардероб
 * нищо не излиза навън само защото е било генерирано.
 */
export async function setPublished(
  userId: string,
  generationId: string,
  published: boolean,
): Promise<PublishResult> {
  const generation = await dbSystem().generation.findUnique({
    where: { id: generationId },
    select: { userId: true, status: true, resultKey: true },
  });

  if (!generation || generation.userId !== userId) {
    return { ok: false, reason: 'NOT_FOUND' };
  }
  if (generation.status !== 'DONE' || !generation.resultKey) {
    return { ok: false, reason: 'NOT_DONE' };
  }

  if (published) {
    const { mayPublish } = await import('./profile');
    const owner = await dbSystem().user.findUnique({
      where: { id: userId },
      select: { wardrobePublic: true, birthYear: true },
    });
    if (!owner || !mayPublish(owner)) {
      return { ok: false, reason: 'WARDROBE_PRIVATE' };
    }
  }

  await dbSystem().generation.update({
    where: { id: generationId },
    data: { publishedAt: published ? new Date() : null },
  });

  return { ok: true, published };
}

// ---------------------------------------------------------------------------
// Харесване и запазване
// ---------------------------------------------------------------------------

export type ToggleResult =
  | { ok: true; on: boolean; likeCount: number }
  | { ok: false; reason: 'NOT_FOUND' | 'NOT_PUBLIC' | 'OWN_LOOK' };

async function publicLook(
  generationId: string,
): Promise<{ userId: string; likeCount: number } | null> {
  const generation = await dbSystem().generation.findUnique({
    where: { id: generationId },
    select: { userId: true, publishedAt: true, likeCount: true },
  });
  if (!generation || !generation.publishedAt) return null;
  return { userId: generation.userId, likeCount: generation.likeCount };
}

/**
 * Харесва или отхаресва.
 *
 * Редът в `look_likes` и броячът в `generations.like_count` се пипат в ЕДНА
 * транзакция. Иначе двойното натискане оставя брояч, който не отговаря на
 * нито един ред — а после никой не може да каже кое е вярното число.
 *
 * Съставният първичен ключ прави второто харесване невъзможно на ниво база.
 */
export async function toggleLike(
  viewerId: string,
  generationId: string,
): Promise<ToggleResult> {
  const look = await publicLook(generationId);
  if (!look) return { ok: false, reason: 'NOT_FOUND' };

  // Собствената визия не се харесва. Не защото е нечестно, а защото число,
  // което всеки може да си вдигне сам, не значи нищо.
  if (look.userId === viewerId) return { ok: false, reason: 'OWN_LOOK' };

  return dbSystem().$transaction(async (tx) => {
    const existing = await tx.lookLike.findUnique({
      where: { userId_generationId: { userId: viewerId, generationId } },
      select: { createdAt: true },
    });

    if (existing) {
      await tx.lookLike.delete({
        where: { userId_generationId: { userId: viewerId, generationId } },
      });
      const updated = await tx.generation.update({
        where: { id: generationId },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true },
      });
      return { ok: true, on: false, likeCount: Math.max(0, updated.likeCount) };
    }

    await tx.lookLike.create({ data: { userId: viewerId, generationId } });
    const updated = await tx.generation.update({
      where: { id: generationId },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
    });
    return { ok: true, on: true, likeCount: updated.likeCount };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}

/** Запазва или маха чужда визия от „Запазени". */
export async function toggleSave(
  viewerId: string,
  generationId: string,
): Promise<ToggleResult> {
  const look = await publicLook(generationId);
  if (!look) return { ok: false, reason: 'NOT_FOUND' };

  const existing = await dbSystem().lookSave.findUnique({
    where: { userId_generationId: { userId: viewerId, generationId } },
    select: { createdAt: true },
  });

  if (existing) {
    await dbSystem().lookSave.delete({
      where: { userId_generationId: { userId: viewerId, generationId } },
    });
    return { ok: true, on: false, likeCount: look.likeCount };
  }

  await dbSystem().lookSave.create({ data: { userId: viewerId, generationId } });
  return { ok: true, on: true, likeCount: look.likeCount };
}

/** Запазените чужди визии, най-новите отгоре. */
export async function savedLooks(viewerId: string, limit = 60): Promise<LookItem[]> {
  const rows = await dbSystem().lookSave.findMany({
    where: { userId: viewerId, generation: { publishedAt: { not: null } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      createdAt: true,
      generation: {
        select: { id: true, category: true, likeCount: true, userId: true },
      },
    },
  });

  const likedIds = new Set(
    (
      await dbSystem().lookLike.findMany({
        where: {
          userId: viewerId,
          generationId: { in: rows.map((row) => row.generation.id) },
        },
        select: { generationId: true },
      })
    ).map((like) => like.generationId),
  );

  return rows.map((row) => ({
    id: row.generation.id,
    category: row.generation.category,
    likeCount: row.generation.likeCount,
    liked: likedIds.has(row.generation.id),
    saved: true,
    mine: row.generation.userId === viewerId,
    createdAt: row.createdAt,
    cursor: row.createdAt.toISOString(),
  }));
}

/**
 * ЧУЖДИТЕ ВИЗИИ, КОИТО ЧОВЕКЪТ Е ХАРЕСАЛ.
 *
 * ═══ ЗАЩО ГИ ЧЕТЕ ГАРДЕРОБЪТ ═══
 *
 * Сърцето в Lookbook и сърцето в гардероба изглеждаха еднакво и значеха
 * различни неща — харесване с брояч срещу „моя любима проба". Хванахме го по
 * логовете: човек харесва в галерията и после търси визията в „Любими".
 *
 * Затова сега сърцето значи ЕДНО НЕЩО, където и да е натиснато. Харесаната
 * чужда визия влиза в „Любими" в гардероба, отбелязана като чужда.
 *
 * ═══ КАКВО НЕ ИЗЛИЗА ОТТУК ═══
 *
 * Само `id` и категорията. Ключът в R2 не напуска сървъра: снимката се
 * показва през `/api/lookbook/{id}/image`, който сам проверява, че визията
 * още е публикувана. Махне ли собственикът визията от галерията, тя изчезва
 * и оттук — заявката вече не я връща.
 */
export type LikedLook = {
  id: string;
  category: StyleCategory | null;
  likedAt: Date;
};

export async function likedLooks(viewerId: string, limit = 60): Promise<LikedLook[]> {
  const rows = await dbSystem().lookLike.findMany({
    where: {
      userId: viewerId,
      // Само визии, които в ТОЗИ момент са публикувани и готови. Отметката
      // остава в базата, но не дава достъп до нищо, което е било свалено.
      generation: {
        publishedAt: { not: null },
        status: 'DONE',
        resultKey: { not: null },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      createdAt: true,
      generation: { select: { id: true, category: true } },
    },
  });

  return rows.map((row) => ({
    id: row.generation.id,
    category: row.generation.category,
    likedAt: row.createdAt,
  }));
}

// ---------------------------------------------------------------------------
// Снимката
// ---------------------------------------------------------------------------

/**
 * Подписан адрес към публикувана визия.
 *
 * Връща `null` за всичко непубликувано — включително за собствените визии на
 * човека. Те се гледат през гардероба, не оттук; един път, едно правило.
 */
export async function publicLookImageUrl(generationId: string): Promise<string | null> {
  const generation = await dbSystem().generation.findUnique({
    where: { id: generationId },
    select: { publishedAt: true, resultKey: true, status: true },
  });

  if (
    !generation ||
    !generation.publishedAt ||
    generation.status !== 'DONE' ||
    !generation.resultKey
  ) {
    return null;
  }

  return getSignedUrl(generation.resultKey);
}
