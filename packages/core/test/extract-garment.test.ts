/**
 * ИЗВЛИЧАНЕ НА ДРЕХА ОТ ЛИНК
 *
 * Мрежата и хранилището са подменени. Проверката на адресите НЕ е подменена —
 * `parsePublicUrl` работи истински, затова вътрешните адреси наистина се
 * отказват и тук.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { resetEnvCache } from '../src/env';
import { BlockedRequestError } from '../src/net-guard';

const pageResponses = new Map<string, { contentType: string; body: Uint8Array }>();

vi.mock('../src/net-guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/net-guard')>();
  return {
    ...actual,
    safeFetch: vi.fn(async (url: string) => {
      // Проверката на адреса остава истинска.
      const parsed = actual.parsePublicUrl(url);
      const prepared = pageResponses.get(parsed.toString());
      if (!prepared) {
        throw new actual.BlockedRequestError('FETCH_FAILED', `няма отговор за ${url}`);
      }
      return { url: parsed.toString(), contentType: prepared.contentType, body: prepared.body };
    }),
  };
});

vi.mock('../src/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/storage')>();
  return { ...actual, putObject: vi.fn(async () => undefined) };
});

const { extractGarment } = await import('../src/extract-garment');
const { putObject } = await import('../src/storage');

const USER_ID = 'user_test_extract';
let jpeg: Buffer;

function html(body: string): Uint8Array {
  return new TextEncoder().encode(body);
}

function servePage(url: string, markup: string): void {
  pageResponses.set(url, { contentType: 'text/html; charset=utf-8', body: html(markup) });
}

function serveImage(url: string, data: Uint8Array = jpeg): void {
  pageResponses.set(url, { contentType: 'image/jpeg', body: data });
}

beforeAll(async () => {
  jpeg = await sharp({
    create: { width: 600, height: 800, channels: 3, background: '#a35' },
  })
    .jpeg()
    .toBuffer();
});

beforeEach(() => {
  pageResponses.clear();
  vi.mocked(putObject).mockClear();
});

afterEach(() => {
  delete process.env.AFFILIATE_ADMITAD_TEMPLATE;
  resetEnvCache();
});

describe('Успешно извличане', () => {
  it('взима og:image, разпознава магазина и качва снимката', async () => {
    servePage(
      'https://www.shein.com/rokla-p-9.html',
      `<html><head>
        <title>Лятна рокля</title>
        <meta property="og:image" content="https://img.shein.com/rokla.jpg">
      </head></html>`,
    );
    serveImage('https://img.shein.com/rokla.jpg');

    const result = await extractGarment(USER_ID, 'https://www.shein.com/rokla-p-9.html');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.merchant).toBe('Shein');
    expect(result.title).toBe('Лятна рокля');
    expect(result.garmentKey).toMatch(new RegExp(`^users/${USER_ID}/garment/.+\\.jpg$`));
    expect(vi.mocked(putObject)).toHaveBeenCalledTimes(1);
  });

  it('прави партньорска връзка, когато има шаблон', async () => {
    process.env.AFFILIATE_ADMITAD_TEMPLATE = 'https://ad.admitad.com/g/xyz/?ulp={url}';
    resetEnvCache();

    servePage(
      'https://answear.bg/p/riza',
      '<head><meta property="og:image" content="https://answear.bg/i/riza.jpg"></head>',
    );
    serveImage('https://answear.bg/i/riza.jpg');

    const result = await extractGarment(USER_ID, 'https://answear.bg/p/riza');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.affiliateUrl).toContain('ad.admitad.com');
    expect(result.affiliateUrl).toContain(encodeURIComponent('https://answear.bg/p/riza'));
  });

  it('работи и с относителен адрес на снимката', async () => {
    servePage(
      'https://vinted.bg/items/42',
      '<head><meta property="og:image" content="/media/42/photo.jpg"></head>',
    );
    serveImage('https://vinted.bg/media/42/photo.jpg');

    const result = await extractGarment(USER_ID, 'https://vinted.bg/items/42');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.merchant).toBe('Vinted');
  });

  it('непознат магазин минава без партньорска връзка', async () => {
    servePage(
      'https://temu.com/p/1',
      '<head><meta property="og:image" content="https://temu.com/i/1.jpg"></head>',
    );
    serveImage('https://temu.com/i/1.jpg');

    const result = await extractGarment(USER_ID, 'https://temu.com/p/1');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.merchant).toBeNull();
    expect(result.affiliateUrl).toBe('https://temu.com/p/1');
  });
});

describe('Отказите', () => {
  it('отказва вътрешен адрес', async () => {
    for (const url of [
      'http://127.0.0.1/x',
      'http://192.168.1.1/x',
      'http://169.254.169.254/latest/meta-data/',
    ]) {
      const result = await extractGarment(USER_ID, url);
      expect(result.ok, url).toBe(false);
      if (!result.ok) expect(result.reason).toBe('BLOCKED');
    }
    expect(vi.mocked(putObject)).not.toHaveBeenCalled();
  });

  it('отказва схема, която не е http', async () => {
    const result = await extractGarment(USER_ID, 'file:///etc/passwd');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('BAD_URL');
  });

  it('казва ясно, когато няма снимка на страницата', async () => {
    servePage('https://zalando.bg/p/1', '<head><title>Само текст</title></head>');

    const result = await extractGarment(USER_ID, 'https://zalando.bg/p/1');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('NO_IMAGE_FOUND');
      expect(result.message).toContain('Качи');
    }
  });

  it('СПИРА снимка, чийто адрес сочи навътре в мрежата', async () => {
    servePage(
      'https://zle.example/p/1',
      '<head><meta property="og:image" content="http://169.254.169.254/latest/meta-data/"></head>',
    );

    const result = await extractGarment(USER_ID, 'https://zle.example/p/1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('BLOCKED');
    expect(vi.mocked(putObject)).not.toHaveBeenCalled();
  });

  it('отказва „снимка", която не е изображение', async () => {
    servePage(
      'https://emag.bg/p/1',
      '<head><meta property="og:image" content="https://emag.bg/i/1.jpg"></head>',
    );
    // Изпълним файл, преименуван на .jpg — същата проверка като при качване.
    const exe = Buffer.alloc(1024);
    exe.write('MZ', 0, 'ascii');
    serveImage('https://emag.bg/i/1.jpg', exe);

    const result = await extractGarment(USER_ID, 'https://emag.bg/i/1.jpg'.replace('/i/1.jpg', '/p/1'));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('IMAGE_UNUSABLE');
    expect(vi.mocked(putObject)).not.toHaveBeenCalled();
  });

  it('казва ясно, когато магазинът не отговаря', async () => {
    const result = await extractGarment(USER_ID, 'https://nqma-go.example/p/1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('FETCH_FAILED');
  });

  it('грешка, която не е от мрежата, не се преглъща', () => {
    expect(new BlockedRequestError('TIMEOUT', 'x').reason).toBe('TIMEOUT');
  });
});
