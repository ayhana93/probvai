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

    // Долната лента трябва да е забележимо различна от оригинала —
    // там седи надписът.
    const crop = { left: 200, top: 900, width: 400, height: 80 };
    const beforeStrip = await sharp(original).extract(crop).raw().toBuffer();
    const afterStrip = await sharp(marked).extract(crop).raw().toBuffer();

    let different = 0;
    for (let i = 0; i < beforeStrip.length; i += 1) {
      if (Math.abs((beforeStrip[i] ?? 0) - (afterStrip[i] ?? 0)) > 8) different += 1;
    }
    expect(different).toBeGreaterThan(500);
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
