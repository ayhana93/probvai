/**
 * ПЪЛНИЯТ ЦИКЪЛ НА ГЕНЕРАЦИЯ
 *
 * Покрива трите неща, които заданието иска да види във Фаза 2:
 *   • един пълен успешен цикъл
 *   • един провал с автоматично връщане на кредита
 *   • че глобалният дневен таван работи (тестван с 0.10)
 *
 * Хранилището е подменено — R2 иска ключове и мрежа, а тук проверяваме
 * логиката. Доставчикът също е подменен: истинският струва пари.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { dbSystem, disconnectAll } from '@probvai/db';

vi.mock('../src/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/storage')>();
  return {
    ...actual,
    getSignedUrl: vi.fn(async (key: string) => `https://signed.example/${key}`),
    putObject: vi.fn(async () => undefined),
    getObject: vi.fn(async () => new Uint8Array()),
  };
});

const { addCredits, getBalance } = await import('../src/credits');
const { resetEnvCache } = await import('../src/env');
const { startGeneration } = await import('../src/generation');
const { spentToday } = await import('../src/limits');
const { registerProvider } = await import('../src/providers');
const { runGenerationJob } = await import('../src/worker/generate-worker');
const { stopBoss } = await import('../src/queue');
const { putObject } = await import('../src/storage');

const system = dbSystem();
const createdUsers: string[] = [];

/** Малко истинско JPEG изображение — работникът наистина го обработва. */
let sampleJpeg: Buffer;

type FakeBehaviour = 'success' | 'fail' | 'pending-forever';

let behaviour: FakeBehaviour = 'success';
let runCalls = 0;

function installFakeProvider(costUSD = 0.075): void {
  registerProvider('fashn_tryon_max', () => ({
    name: 'fashn_tryon_max' as const,
    costUSD,
    supportsAspectRatio: true,
    async run() {
      runCalls += 1;
      return { jobId: `fake-${runCalls}` };
    },
    async poll() {
      if (behaviour === 'fail') {
        return {
          status: 'failed' as const,
          errorCode: 'PROVIDER_FAILED' as const,
          detail: 'нарочен провал в теста',
        };
      }
      if (behaviour === 'pending-forever') {
        return { status: 'pending' as const };
      }
      return {
        status: 'done' as const,
        imageUrl: `data:image/jpeg;base64,${sampleJpeg.toString('base64')}`,
      };
    },
  }));
}

async function makeUser(credits: number, options: { purchased?: boolean } = {}) {
  const user = await system.user.create({
    data: { email: `gen-${crypto.randomUUID()}@example.test` },
    select: { id: true },
  });
  createdUsers.push(user.id);

  if (credits > 0) {
    await addCredits(user.id, credits, options.purchased ? 'PURCHASE' : 'ADMIN', crypto.randomUUID());
  }
  return user.id;
}

function keysFor(userId: string) {
  return {
    personKey: `users/${userId}/person/${crypto.randomUUID()}.jpg`,
    garmentKey: `users/${userId}/garment/${crypto.randomUUID()}.jpg`,
  };
}

beforeAll(async () => {
  sampleJpeg = await sharp({
    create: { width: 512, height: 640, channels: 3, background: '#b47' },
  })
    .jpeg()
    .toBuffer();
});

beforeEach(() => {
  behaviour = 'success';
  runCalls = 0;
  installFakeProvider();
  vi.mocked(putObject).mockClear();
  // Изчакването между заявките пречи на тестовете — нулираме го.
  process.env.GENERATION_COOLDOWN_SECONDS = '0';
  resetEnvCache();
});

afterEach(async () => {
  if (createdUsers.length > 0) {
    await system.generation.deleteMany({ where: { userId: { in: createdUsers } } });
    await system.user.deleteMany({ where: { id: { in: createdUsers } } });
    createdUsers.length = 0;
  }
  delete process.env.MAX_DAILY_SPEND_USD_OVERRIDE;
  resetEnvCache();
});

afterAll(async () => {
  await stopBoss();
  await disconnectAll();
});

// ---------------------------------------------------------------------------

describe('Успешен цикъл', () => {
  it('минава от заявка до готово изображение', async () => {
    const userId = await makeUser(3);
    const keys = keysFor(userId);

    // ── Заявката ──
    const started = await startGeneration({
      userId,
      ...keys,
      aspectRatio: '3:4',
      source: 'LINK',
      merchant: 'Shein',
      productUrl: 'https://bg.shein.com/lyatna-roklya-p-123.html',
    });

    expect(started.ok).toBe(true);
    if (!started.ok) return;

    // Кредитът е удържан ПРЕДИ доставчикът да е бил викан.
    expect(started.balance).toBe(2);
    expect(await getBalance(userId)).toBe(2);
    expect(runCalls).toBe(0);

    const queued = await system.generation.findUniqueOrThrow({
      where: { id: started.generationId },
    });
    expect(queued.status).toBe('QUEUED');
    expect(queued.aspectRatio).toBe('3:4');
    expect(queued.source).toBe('LINK');
    expect(queued.merchant).toBe('Shein');
    // Себестойността е запазена още при създаването.
    expect(Number(queued.costUSD)).toBeCloseTo(0.075, 4);

    // ── Работникът ──
    await runGenerationJob({ generationId: started.generationId });

    const done = await system.generation.findUniqueOrThrow({
      where: { id: started.generationId },
    });

    expect(done.status).toBe('DONE');
    expect(done.resultKey).toMatch(new RegExp(`^users/${userId}/result/`));
    expect(done.providerJobId).toBe('fake-1');
    expect(done.completedAt).not.toBeNull();
    expect(runCalls).toBe(1);
    expect(vi.mocked(putObject)).toHaveBeenCalledTimes(1);

    // Балансът не мърда след започването.
    expect(await getBalance(userId)).toBe(2);
  });

  it('при КАЧЕНА снимка не записва магазин, дори да е подаден', async () => {
    // Правилото от заданието: името на магазина се показва само когато
    // дрехата е дошла през линк. При качена снимка нямаме откъде да знаем
    // от кой магазин е — а измислено име е по-лошо от липсващо.
    const userId = await makeUser(1);

    const started = await startGeneration({
      userId,
      ...keysFor(userId),
      aspectRatio: 'auto',
      source: 'UPLOAD',
      merchant: 'Shein',
      productUrl: 'https://bg.shein.com/nesto.html',
    });
    if (!started.ok) throw new Error('не тръгна');

    const queued = await system.generation.findUniqueOrThrow({
      where: { id: started.generationId },
    });

    expect(queued.source).toBe('UPLOAD');
    expect(queued.merchant).toBeNull();
    expect(queued.productUrl).toBeNull();
  });

  it('дава категория и точка опит на готовата визия', async () => {
    const userId = await makeUser(1);

    const started = await startGeneration({
      userId,
      ...keysFor(userId),
      aspectRatio: 'auto',
      source: 'LINK',
      merchant: 'Shein',
      productUrl: 'https://bg.shein.com/women/dresses/summer-linen-dress-1.html',
    });
    if (!started.ok) throw new Error('не тръгна');

    await runGenerationJob({ generationId: started.generationId });

    const done = await system.generation.findUniqueOrThrow({
      where: { id: started.generationId },
    });
    expect(done.category).toBe('SUMMER');

    const user = await system.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.xp).toBe(1);
  });

  it('провалена генерация НЕ дава точка опит', async () => {
    // Иначе нивата растат от нашите грешки.
    const userId = await makeUser(2);
    behaviour = 'fail';

    const started = await startGeneration({ userId, ...keysFor(userId), aspectRatio: 'auto' });
    if (!started.ok) throw new Error('не тръгна');

    await runGenerationJob({ generationId: started.generationId });

    const user = await system.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.xp).toBe(0);
  });

  it('слага воден знак на потребител, който не е купувал', async () => {
    const userId = await makeUser(1);
    const started = await startGeneration({ userId, ...keysFor(userId), aspectRatio: 'auto' });
    if (!started.ok) throw new Error('не тръгна');

    await runGenerationJob({ generationId: started.generationId });

    const done = await system.generation.findUniqueOrThrow({
      where: { id: started.generationId },
    });
    expect(done.watermarked).toBe(true);
  });

  it('НЕ слага воден знак на потребител, който е купувал', async () => {
    const userId = await makeUser(1, { purchased: true });
    const started = await startGeneration({ userId, ...keysFor(userId), aspectRatio: 'auto' });
    if (!started.ok) throw new Error('не тръгна');

    await runGenerationJob({ generationId: started.generationId });

    const done = await system.generation.findUniqueOrThrow({
      where: { id: started.generationId },
    });
    expect(done.watermarked).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('Провал с автоматично връщане', () => {
  it('връща кредита и нулира себестойността', async () => {
    const userId = await makeUser(2);
    behaviour = 'fail';

    const started = await startGeneration({ userId, ...keysFor(userId), aspectRatio: 'auto' });
    if (!started.ok) throw new Error('не тръгна');
    expect(await getBalance(userId)).toBe(1);

    await runGenerationJob({ generationId: started.generationId });

    const failed = await system.generation.findUniqueOrThrow({
      where: { id: started.generationId },
    });

    expect(failed.status).toBe('FAILED');
    expect(failed.errorCode).toBe('PROVIDER_FAILED');
    // За неуспяла генерация не плащаме — не бива да тежи на дневния таван.
    expect(failed.costUSD).toBeNull();

    expect(await getBalance(userId)).toBe(2);
  });

  it('втори опит по същата задача не връща втори кредит', async () => {
    const userId = await makeUser(2);
    behaviour = 'fail';

    const started = await startGeneration({ userId, ...keysFor(userId), aspectRatio: 'auto' });
    if (!started.ok) throw new Error('не тръгна');

    await runGenerationJob({ generationId: started.generationId });
    await runGenerationJob({ generationId: started.generationId });

    expect(await getBalance(userId)).toBe(2);
  });

  it('повторно хващане на задача НЕ плаща втори път при доставчика', async () => {
    const userId = await makeUser(2);
    behaviour = 'pending-forever';

    const started = await startGeneration({ userId, ...keysFor(userId), aspectRatio: 'auto' });
    if (!started.ok) throw new Error('не тръгна');

    // Първият опит спира по таймаут, но е записал providerJobId.
    process.env.GENERATION_TIMEOUT_SECONDS = '1';
    resetEnvCache();
    await runGenerationJob({ generationId: started.generationId });
    expect(runCalls).toBe(1);

    // Задачата е приключила като FAILED, значи второто хващане я пропуска.
    const after = await system.generation.findUniqueOrThrow({
      where: { id: started.generationId },
    });
    expect(after.status).toBe('FAILED');
    expect(after.providerJobId).toBe('fake-1');

    await runGenerationJob({ generationId: started.generationId });
    expect(runCalls).toBe(1);

    delete process.env.GENERATION_TIMEOUT_SECONDS;
    resetEnvCache();
  });
});

// ---------------------------------------------------------------------------

describe('Глобалният дневен таван', () => {
  it('спира генерациите при MAX_DAILY_SPEND_USD=0.10', async () => {
    const userId = await makeUser(10);

    process.env.MAX_DAILY_SPEND_USD = '0.10';
    resetEnvCache();

    try {
      // Себестойност 0.075 — първата минава.
      const first = await startGeneration({ userId, ...keysFor(userId), aspectRatio: 'auto' });
      expect(first.ok).toBe(true);

      const spent = await spentToday();
      expect(spent).toBeGreaterThanOrEqual(0.075);

      // Втората би направила 0.15 при таван 0.10 — спира.
      const second = await startGeneration({ userId, ...keysFor(userId), aspectRatio: 'auto' });
      expect(second.ok).toBe(false);
      if (!second.ok) expect(second.reason).toBe('GLOBAL_DAILY_CAP');

      // И най-важното: кредитът НЕ е удържан за спряната заявка.
      expect(await getBalance(userId)).toBe(9);
    } finally {
      process.env.MAX_DAILY_SPEND_USD = '25';
      resetEnvCache();
    }
  });

  it('таванът важи за всички, не само за виновния потребител', async () => {
    const first = await makeUser(5);
    const second = await makeUser(5);

    process.env.MAX_DAILY_SPEND_USD = '0.10';
    resetEnvCache();

    try {
      await startGeneration({ userId: first, ...keysFor(first), aspectRatio: 'auto' });

      const other = await startGeneration({
        userId: second,
        ...keysFor(second),
        aspectRatio: 'auto',
      });

      expect(other.ok).toBe(false);
      if (!other.ok) expect(other.reason).toBe('GLOBAL_DAILY_CAP');
      expect(await getBalance(second)).toBe(5);
    } finally {
      process.env.MAX_DAILY_SPEND_USD = '25';
      resetEnvCache();
    }
  });
});

// ---------------------------------------------------------------------------

describe('Проверки преди харчене на кредит', () => {
  it('непознато съотношение е отказ без харчене', async () => {
    const userId = await makeUser(3);

    const result = await startGeneration({
      userId,
      ...keysFor(userId),
      aspectRatio: '16:9' as never,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('BAD_ASPECT_RATIO');
    expect(await getBalance(userId)).toBe(3);
  });

  it('чужд ключ е отказ без харчене', async () => {
    const mine = await makeUser(3);
    const other = await makeUser(1);

    const result = await startGeneration({
      userId: mine,
      personKey: `users/${other}/person/x.jpg`,
      garmentKey: `users/${mine}/garment/y.jpg`,
      aspectRatio: 'auto',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('NOT_YOUR_FILE');
    expect(await getBalance(mine)).toBe(3);
  });

  it('без кредити не се стига до доставчика', async () => {
    const userId = await makeUser(0);

    const result = await startGeneration({ userId, ...keysFor(userId), aspectRatio: 'auto' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('INSUFFICIENT_CREDITS');
    expect(runCalls).toBe(0);
  });

  it('изчакването между две заявки работи', async () => {
    process.env.GENERATION_COOLDOWN_SECONDS = '15';
    resetEnvCache();

    try {
      const userId = await makeUser(5);
      const first = await startGeneration({ userId, ...keysFor(userId), aspectRatio: 'auto' });
      expect(first.ok).toBe(true);

      const second = await startGeneration({ userId, ...keysFor(userId), aspectRatio: 'auto' });
      expect(second.ok).toBe(false);
      if (!second.ok) {
        expect(second.reason).toBe('COOLDOWN');
        expect(second.retryAfterSeconds).toBeGreaterThan(0);
      }
      expect(await getBalance(userId)).toBe(4);
    } finally {
      process.env.GENERATION_COOLDOWN_SECONDS = '0';
      resetEnvCache();
    }
  });

  it('режимът на поддръжка спира всичко', async () => {
    process.env.MAINTENANCE_MODE = '1';
    resetEnvCache();

    try {
      const userId = await makeUser(5);
      const result = await startGeneration({ userId, ...keysFor(userId), aspectRatio: 'auto' });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('MAINTENANCE');
      expect(await getBalance(userId)).toBe(5);
    } finally {
      process.env.MAINTENANCE_MODE = '0';
      resetEnvCache();
    }
  });
});
