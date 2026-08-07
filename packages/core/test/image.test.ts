/**
 * Проверка на качените изображения.
 *
 * Покрива точката от контролния списък:
 *   „Файл .exe, преименуван на .jpg → отказ"
 *
 * Разширението не се проверява никъде в кода — нарочно. Проверява се
 * съдържанието, защото името на файла е текст, който всеки може да напише.
 */

import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { prepareUserImage, sniffImageFormat } from '../src/image';

async function makeImage(
  format: 'jpeg' | 'png' | 'webp',
  width = 600,
  height = 800,
): Promise<Buffer> {
  const base = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 120, b: 180 },
    },
  });
  if (format === 'jpeg') return base.jpeg().toBuffer();
  if (format === 'png') return base.png().toBuffer();
  return base.webp().toBuffer();
}

describe('Разпознаване по magic bytes', () => {
  it('разпознава jpeg, png и webp', async () => {
    expect(sniffImageFormat(await makeImage('jpeg'))).toBe('jpeg');
    expect(sniffImageFormat(await makeImage('png'))).toBe('png');
    expect(sniffImageFormat(await makeImage('webp'))).toBe('webp');
  });

  it('не разпознава изпълним файл, преименуван на .jpg', () => {
    // MZ — началото на Windows изпълним файл.
    const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    expect(sniffImageFormat(exe)).toBeNull();
  });

  it('не разпознава ELF, PDF, ZIP и обикновен текст', () => {
    expect(sniffImageFormat(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))).toBeNull();
    expect(sniffImageFormat(Buffer.from('%PDF-1.7'))).toBeNull();
    expect(sniffImageFormat(Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toBeNull();
    expect(sniffImageFormat(Buffer.from('здравей'))).toBeNull();
  });

  it('не се подлъгва по RIFF без WEBP', () => {
    // WAV файл: RIFF....WAVE
    const wav = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from('WAVE'),
    ]);
    expect(sniffImageFormat(wav)).toBeNull();
  });
});

describe('prepareUserImage — отказите', () => {
  it('отказва изпълним файл, преименуван на снимка', async () => {
    const exe = Buffer.alloc(2048);
    exe.write('MZ', 0, 'ascii');

    const result = await prepareUserImage(exe);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('UNSUPPORTED_TYPE');
  });

  it('отказва празен файл', async () => {
    const result = await prepareUserImage(new Uint8Array(0));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('EMPTY_FILE');
  });

  it('отказва файл над лимита', async () => {
    const image = await makeImage('jpeg');
    const result = await prepareUserImage(image, { maxBytes: 100 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('TOO_LARGE');
  });

  it('отказва правилни първи байтове с боклук след тях', async () => {
    // Началото на PNG, но нататък нищо смислено.
    const fake = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(512, 0x41),
    ]);

    const result = await prepareUserImage(fake);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('CORRUPT_IMAGE');
  });
});

describe('prepareUserImage — обработката', () => {
  it('смалява дългата страна до лимита и пази пропорцията', async () => {
    const big = await makeImage('jpeg', 4000, 3000);

    const result = await prepareUserImage(big, { maxDimension: 2048 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.image.width).toBe(2048);
    expect(result.image.height).toBe(1536);
  });

  it('не уголемява малки снимки', async () => {
    const small = await makeImage('png', 300, 400);

    const result = await prepareUserImage(small, { maxDimension: 2048 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.image.width).toBe(300);
    expect(result.image.height).toBe(400);
  });

  it('запазва формата и връща правилното разширение', async () => {
    const webp = await prepareUserImage(await makeImage('webp'));
    expect(webp.ok).toBe(true);
    if (webp.ok) {
      expect(webp.image.format).toBe('webp');
      expect(webp.image.extension).toBe('webp');
      expect(webp.image.contentType).toBe('image/webp');
    }

    const jpeg = await prepareUserImage(await makeImage('jpeg'));
    if (jpeg.ok) expect(jpeg.image.extension).toBe('jpg');
  });

  it('маха метаданните — GPS координатите не бива да тръгват с файла', async () => {
    const withExif = await sharp({
      create: { width: 400, height: 400, channels: 3, background: '#c86' },
    })
      .withExif({
        IFD0: { Copyright: 'ПРОБВАЙ тест' },
        GPSIFD: { GPSLatitudeRef: 'N', GPSLongitudeRef: 'E' },
      })
      .jpeg()
      .toBuffer();

    // Убеждаваме се, че входът наистина носи EXIF.
    expect((await sharp(withExif).metadata()).exif).toBeDefined();

    const result = await prepareUserImage(withExif);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((await sharp(result.image.data).metadata()).exif).toBeUndefined();
  });
});
