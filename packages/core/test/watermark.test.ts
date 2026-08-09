/**
 * ВОДЕН ЗНАК
 *
 * Проверява две неща: че знакът наистина променя изображението и че
 * правилото „кой го получава" работи — купувал ли е потребителят кредити.
 */

import { afterAll, afterEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { dbSystem, disconnectAll } from '@probvai/db';
import { addCredits } from '../src/credits';
import { applyWatermark, hasEverPurchased, shouldWatermark } from '../src/watermark';

const system = dbSystem();
const createdUsers: string[] = [];

async function makeUser(): Promise<string> {
  const user = await system.user.create({
    data: { email: `wm-${crypto.randomUUID()}@example.test` },
    select: { id: true },
  });
  createdUsers.push(user.id);
  return user.id;
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

async function sample(width = 800, height = 1000): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: '#5a4a6a' },
  })
    .jpeg()
    .toBuffer();
}

/**
 * Колко байта се различават в дадено парче от двете снимки.
 *
 * Прагът 8 е заради JPEG: същият пиксел, минал през компресия още веднъж,
 * се мени с една-две единици. Без него „непроменена" област никога не
 * излиза непроменена.
 */
async function differingBytes(
  before: Buffer,
  after: Buffer,
  crop: { left: number; top: number; width: number; height: number },
): Promise<number> {
  const a = await sharp(before).extract(crop).raw().toBuffer();
  const b = await sharp(after).extract(crop).raw().toBuffer();

  let different = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (Math.abs((a[i] ?? 0) - (b[i] ?? 0)) > 8) different += 1;
  }
  return different;
}

describe('Налагане на знака', () => {
  it('запазва размерите на снимката', async () => {
    const original = await sample(768, 1024);
    const marked = await applyWatermark(original);

    const meta = await sharp(marked).metadata();
    expect(meta.width).toBe(768);
    expect(meta.height).toBe(1024);
  });

  it('наистина променя пикселите', async () => {
    const original = await sample();
    const marked = await applyWatermark(original);

    expect(Buffer.compare(original, marked)).not.toBe(0);

    // Знакът е в ДОЛНИЯ ДЕСЕН ъгъл. На 800×1000 това значи широчина 176 и
    // отстъп 28, тоест някъде между 596 и 772 по хоризонтала.
    const corner = { left: 560, top: 880, width: 240, height: 120 };
    expect(await differingBytes(original, marked, corner)).toBeGreaterThan(500);
  });

  it('НЕ пипа останалата част от снимката', async () => {
    // Знакът беше и повтарящ се диагонален надпис през цялата снимка. Това
    // пазеше повече и разваляше снимката — а безплатните проби се споделят
    // и точно това е каналът, който трябва да ни храни.
    const original = await sample();
    const marked = await applyWatermark(original);

    for (const patch of [
      { left: 0, top: 0, width: 300, height: 300 },
      { left: 400, top: 300, width: 300, height: 300 },
      { left: 0, top: 850, width: 300, height: 150 },
    ]) {
      expect(await differingBytes(original, marked, patch)).toBe(0);
    }
  });

  it('работи и на малки, и на големи снимки', async () => {
    for (const [w, h] of [
      [320, 400],
      [1024, 1024],
      [1080, 1920],
    ] as const) {
      const marked = await applyWatermark(await sample(w, h));
      const meta = await sharp(marked).metadata();
      expect(meta.width, `${w}x${h}`).toBe(w);
    }
  });

  it('отказва вход, който не е изображение', async () => {
    await expect(applyWatermark(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow();
  });
});

describe('Кой получава воден знак', () => {
  it('потребител без покупки — да', async () => {
    const userId = await makeUser();
    expect(await hasEverPurchased(userId)).toBe(false);
    expect(await shouldWatermark(userId)).toBe(true);
  });

  it('безплатните кредити не се броят за покупка', async () => {
    const userId = await makeUser();
    await addCredits(userId, 3, 'SIGNUP');
    await addCredits(userId, 1, 'EMAIL_VERIFY');

    expect(await shouldWatermark(userId)).toBe(true);
  });

  it('след покупка — не', async () => {
    const userId = await makeUser();
    await addCredits(userId, 25, 'PURCHASE', 'cs_test_wm');

    expect(await hasEverPurchased(userId)).toBe(true);
    expect(await shouldWatermark(userId)).toBe(false);
  });

  it('веднъж купил, завинаги без знак — дори когато кредитите свършат', async () => {
    const userId = await makeUser();
    await addCredits(userId, 25, 'PURCHASE', `cs_${crypto.randomUUID()}`);

    // Изхарчва всичко.
    await system.user.update({ where: { id: userId }, data: { credits: 0 } });
    await system.creditLedger.create({
      data: { userId, delta: -25, reason: 'ADMIN', balance: 0 },
    });

    expect(await shouldWatermark(userId)).toBe(false);
  });
});
