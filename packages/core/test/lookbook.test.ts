/**
 * LOOKBOOK
 *
 * Три неща, които трябва да са верни:
 *   1. непубликувано не се вижда от никого;
 *   2. броячът на харесвания винаги отговаря на редовете в базата;
 *   3. скролването не повтаря и не пропуска визии.
 *
 * И едно, което трябва да е невъзможно: публикуване от личен гардероб.
 */

import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { dbSystem, disconnectAll } from '@probvai/db';
import {
  lookbookFeed,
  looksPublishedAfter,
  newSeed,
  setPublished,
  toggleLike,
  toggleSave,
  savedLooks,
  type LookPage,
} from '../src/lookbook';

const system = dbSystem();
const createdUsers: string[] = [];

async function makeUser(options: { public?: boolean; age?: number } = {}): Promise<string> {
  const age = options.age ?? 30;
  const user = await system.user.create({
    data: {
      email: `look-${crypto.randomUUID()}@example.test`,
      wardrobePublic: options.public ?? false,
      birthYear: new Date().getFullYear() - age,
      profileCompletedAt: new Date(),
    },
    select: { id: true },
  });
  createdUsers.push(user.id);
  return user.id;
}

async function makeLook(userId: string): Promise<string> {
  const generation = await system.generation.create({
    data: {
      userId,
      status: 'DONE',
      provider: 'fashn_tryon_max',
      personKey: `users/${userId}/person/a.jpg`,
      garmentKey: `users/${userId}/garment/b.jpg`,
      resultKey: `users/${userId}/result/c.jpg`,
      category: 'SUMMER',
    },
    select: { id: true },
  });
  return generation.id;
}

afterEach(async () => {
  if (createdUsers.length > 0) {
    await system.user.deleteMany({ where: { id: { in: createdUsers } } });
    createdUsers.length = 0;
  }
});

afterAll(async () => {
  await disconnectAll();
});

// ---------------------------------------------------------------------------

describe('Публикуване', () => {
  it('личен гардероб не публикува', async () => {
    const userId = await makeUser({ public: false });
    const lookId = await makeLook(userId);

    const result = await setPublished(userId, lookId, true);

    expect(result).toMatchObject({ ok: false, reason: 'WARDROBE_PRIVATE' });
  });

  it('под 18 не публикува дори с публичен гардероб', async () => {
    // Отметката може да е сложена преди рожден ден или през друг път.
    // Проверката е при самото публикуване, не само при регистрацията.
    const userId = await makeUser({ public: true, age: 16 });
    const lookId = await makeLook(userId);

    expect(await setPublished(userId, lookId, true)).toMatchObject({
      ok: false,
      reason: 'WARDROBE_PRIVATE',
    });
  });

  it('чужда визия не се публикува', async () => {
    const owner = await makeUser({ public: true });
    const stranger = await makeUser({ public: true });
    const lookId = await makeLook(owner);

    expect(await setPublished(stranger, lookId, true)).toMatchObject({
      ok: false,
      reason: 'NOT_FOUND',
    });
  });

  it('публикува и маха', async () => {
    const userId = await makeUser({ public: true });
    const lookId = await makeLook(userId);

    expect(await setPublished(userId, lookId, true)).toMatchObject({ ok: true });

    const published = await system.generation.findUniqueOrThrow({ where: { id: lookId } });
    expect(published.publishedAt).not.toBeNull();

    expect(await setPublished(userId, lookId, false)).toMatchObject({ ok: true });

    const hidden = await system.generation.findUniqueOrThrow({ where: { id: lookId } });
    expect(hidden.publishedAt).toBeNull();
  });
});

describe('Галерията', () => {
  it('показва само публикуваните', async () => {
    const owner = await makeUser({ public: true });
    const viewer = await makeUser();

    const shown = await makeLook(owner);
    const hidden = await makeLook(owner);
    await setPublished(owner, shown, true);

    // ═══ ЗАЩО СЕ ЛИСТВА, А НЕ СЕ ГЛЕДА ПЪРВАТА СТРАНИЦА ═══
    //
    // Подредбата е случайна и една страница е дванайсет визии от всичко в
    // базата. Първата версия на този тест гледаше само първата страница и
    // минаваше единствено докато базата беше почти празна — с двайсетина реда
    // вътре вече падаше, без нищо в кода да се е счупило. Тест, който зависи
    // от това колко данни има наоколо, не проверява нищо.
    const seed = newSeed();
    const ids: string[] = [];
    let cursor: string | null = null;

    for (let page = 0; page < 50; page += 1) {
      const result: LookPage = await lookbookFeed({ viewerId: viewer, seed, cursor });
      ids.push(...result.items.map((item) => item.id));
      cursor = result.nextCursor;
      if (cursor === null) break;
    }

    expect(ids).toContain(shown);
    expect(ids).not.toContain(hidden);
  });

  /**
   * ═══ „НОВО" ТРЯБВА ДА ЗНАЧИ НОВО ═══
   *
   * Екранът пита през равни промеждутъци какво е излязло, откакто гледа. Преди
   * това ставаше с ново семе и първа страница, а за нови се смятаха всички
   * непознати визии — тоест при пълна галерия почти всичко. Копчето обявяваше
   * „12 нови визии", без някой да е публикувал нищо.
   *
   * Тук се проверява точно това: публикуваното ПРЕДИ котвата не се брои,
   * публикуваното след нея — да.
   */
  it('новото значи публикуваното след даден момент', async () => {
    const owner = await makeUser({ public: true });
    const viewer = await makeUser();

    const older = await makeLook(owner);
    await setPublished(owner, older, true);

    const anchor = new Date();
    // Времето в базата е с точност до милисекунда — без тази пауза двете
    // публикации падат в един и същ миг и проверката губи смисъл.
    await new Promise((resolve) => setTimeout(resolve, 20));

    const newer = await makeLook(owner);
    await setPublished(owner, newer, true);

    const result = await looksPublishedAfter({ viewerId: viewer, since: anchor });
    const ids = result.items.map((item) => item.id);

    expect(ids).toContain(newer);
    expect(ids).not.toContain(older);
    expect(result.newest).not.toBeNull();
  });

  it('няма ново значи празен списък', async () => {
    const owner = await makeUser({ public: true });
    const viewer = await makeUser();

    const lookId = await makeLook(owner);
    await setPublished(owner, lookId, true);

    const result = await looksPublishedAfter({ viewerId: viewer, since: new Date() });

    expect(result.items).toEqual([]);
    expect(result.newest).toBeNull();
  });

  it('скролването не повтаря и не пропуска', async () => {
    // Точно това чупи `ORDER BY random()`: при него една визия излиза
    // няколко пъти, а друга не излиза изобщо.
    const owner = await makeUser({ public: true });
    const viewer = await makeUser();

    const mine: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      const lookId = await makeLook(owner);
      await setPublished(owner, lookId, true);
      mine.push(lookId);
    }

    const seed = newSeed();
    const seen: string[] = [];
    let cursor: string | null = null;

    for (let page = 0; page < 10; page += 1) {
      const result = await lookbookFeed({ viewerId: viewer, seed, cursor, limit: 3 });
      seen.push(...result.items.map((item) => item.id));
      cursor = result.nextCursor;
      if (cursor === null) break;
    }

    const ours = seen.filter((id) => mine.includes(id));
    expect(new Set(ours).size).toBe(ours.length); // без повторения
    expect(new Set(ours).size).toBe(mine.length); // без пропуснати
  });
});

describe('Харесване', () => {
  it('вдига и сваля брояча, и той отговаря на редовете', async () => {
    const owner = await makeUser({ public: true });
    const viewer = await makeUser();
    const lookId = await makeLook(owner);
    await setPublished(owner, lookId, true);

    expect(await toggleLike(viewer, lookId)).toMatchObject({ on: true, likeCount: 1 });

    expect(await system.lookLike.count({ where: { generationId: lookId } })).toBe(1);

    expect(await toggleLike(viewer, lookId)).toMatchObject({ on: false, likeCount: 0 });
    expect(await system.lookLike.count({ where: { generationId: lookId } })).toBe(0);
  });

  it('своята визия не се харесва', async () => {
    // Число, което всеки може да си вдигне сам, не значи нищо.
    const owner = await makeUser({ public: true });
    const lookId = await makeLook(owner);
    await setPublished(owner, lookId, true);

    expect(await toggleLike(owner, lookId)).toMatchObject({
      ok: false,
      reason: 'OWN_LOOK',
    });
  });

  it('непубликувана визия не се харесва', async () => {
    const owner = await makeUser({ public: true });
    const viewer = await makeUser();
    const lookId = await makeLook(owner);

    expect(await toggleLike(viewer, lookId)).toMatchObject({
      ok: false,
      reason: 'NOT_FOUND',
    });
  });

  it('пет души харесват веднъж всеки — броячът е точно 5', async () => {
    const owner = await makeUser({ public: true });
    const lookId = await makeLook(owner);
    await setPublished(owner, lookId, true);

    const viewers = await Promise.all(Array.from({ length: 5 }, () => makeUser()));
    await Promise.all(viewers.map((viewer) => toggleLike(viewer, lookId)));

    const look = await system.generation.findUniqueOrThrow({ where: { id: lookId } });
    expect(look.likeCount).toBe(5);
    expect(await system.lookLike.count({ where: { generationId: lookId } })).toBe(5);
  });
});

describe('Запазване', () => {
  it('запазва, показва в списъка и маха', async () => {
    const owner = await makeUser({ public: true });
    const viewer = await makeUser();
    const lookId = await makeLook(owner);
    await setPublished(owner, lookId, true);

    expect(await toggleSave(viewer, lookId)).toMatchObject({ on: true });
    expect((await savedLooks(viewer)).map((item) => item.id)).toEqual([lookId]);

    expect(await toggleSave(viewer, lookId)).toMatchObject({ on: false });
    expect(await savedLooks(viewer)).toHaveLength(0);
  });

  it('махната от галерията визия изчезва и от запазените', async () => {
    const owner = await makeUser({ public: true });
    const viewer = await makeUser();
    const lookId = await makeLook(owner);
    await setPublished(owner, lookId, true);
    await toggleSave(viewer, lookId);

    await setPublished(owner, lookId, false);

    expect(await savedLooks(viewer)).toHaveLength(0);
  });
});
