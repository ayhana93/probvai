/**
 * Разпознаване на магазини, партньорски връзки и четене на мета тагове.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { affiliateUrl, merchantFor } from '../src/merchants';
import { linkHref, metaContent, pageTitle } from '../src/html-meta';
import { resetEnvCache } from '../src/env';
import { startOfDay } from '../src/time';

afterEach(() => {
  delete process.env.AFFILIATE_ADMITAD_TEMPLATE;
  delete process.env.AFFILIATE_AWIN_TEMPLATE;
  resetEnvCache();
});

describe('Разпознаване на магазин', () => {
  it('хваща магазините от заданието', () => {
    expect(merchantFor('shein.com')?.name).toBe('Shein');
    expect(merchantFor('vinted.bg')?.name).toBe('Vinted');
    expect(merchantFor('about-you.bg')?.name).toBe('About You');
    expect(merchantFor('answear.bg')?.name).toBe('Answear');
    expect(merchantFor('zalando.bg')?.name).toBe('Zalando');
    expect(merchantFor('emag.bg')?.name).toBe('eMAG');
  });

  it('хваща и поддомейните', () => {
    expect(merchantFor('www.shein.com')?.name).toBe('Shein');
    expect(merchantFor('bg.shein.com')?.name).toBe('Shein');
    expect(merchantFor('m.zalando.bg')?.name).toBe('Zalando');
  });

  it('не се подлъгва по подобно име', () => {
    expect(merchantFor('shein.com.evil.example')).toBeNull();
    expect(merchantFor('notshein.com')).toBeNull();
    expect(merchantFor('temu.com')).toBeNull();
  });
});

describe('Партньорски връзки', () => {
  it('без настроен шаблон връща оригиналния адрес', () => {
    const merchant = merchantFor('shein.com');
    const url = 'https://shein.com/rokla-p-1.html';
    expect(affiliateUrl(url, merchant)).toBe(url);
  });

  it('с шаблон вгражда адреса кодиран', () => {
    process.env.AFFILIATE_ADMITAD_TEMPLATE = 'https://ad.admitad.com/g/abc/?ulp={url}';
    resetEnvCache();

    const merchant = merchantFor('shein.com');
    const url = 'https://shein.com/rokla-p-1.html?color=red';

    expect(affiliateUrl(url, merchant)).toBe(
      `https://ad.admitad.com/g/abc/?ulp=${encodeURIComponent(url)}`,
    );
  });

  it('магазин без мрежа никога не получава партньорска връзка', () => {
    process.env.AFFILIATE_ADMITAD_TEMPLATE = 'https://ad.admitad.com/g/abc/?ulp={url}';
    resetEnvCache();

    const vinted = merchantFor('vinted.bg');
    const url = 'https://vinted.bg/items/1';
    expect(affiliateUrl(url, vinted)).toBe(url);
  });

  it('непознат магазин минава без промяна', () => {
    const url = 'https://temu.com/x';
    expect(affiliateUrl(url, null)).toBe(url);
  });
});

describe('Четене на мета тагове', () => {
  const html = `<!doctype html><html><head>
    <title>Лятна рокля на цветя — Shein</title>
    <meta property="og:title" content="Лятна рокля">
    <meta property="og:image" content="https://img.shein.com/rokla.jpg">
    <meta name="twitter:image" content="https://img.shein.com/twitter.jpg">
    <link rel="image_src" href="https://img.shein.com/legacy.jpg">
  </head><body><meta property="og:image" content="https://зло.example/late.jpg"></body></html>`;

  it('намира og:image', () => {
    expect(metaContent(html, ['og:image'])).toBe('https://img.shein.com/rokla.jpg');
  });

  it('спазва реда на предпочитанието', () => {
    expect(metaContent(html, ['og:image:secure_url', 'og:image', 'twitter:image'])).toBe(
      'https://img.shein.com/rokla.jpg',
    );
    expect(metaContent(html, ['twitter:image', 'og:image'])).toBe(
      'https://img.shein.com/twitter.jpg',
    );
  });

  it('не чете тагове извън head', () => {
    // Тагът в body сочи другаде — не бива да го хващаме.
    expect(metaContent(html, ['og:image'])).not.toContain('зло.example');
  });

  it('намира link rel=image_src', () => {
    expect(linkHref(html, 'image_src')).toBe('https://img.shein.com/legacy.jpg');
  });

  it('чете заглавието', () => {
    expect(pageTitle(html)).toBe('Лятна рокля на цветя — Shein');
  });

  it('разкодира HTML entity-та в адреса', () => {
    const withEntities =
      '<head><meta property="og:image" content="https://x.example/a.jpg?w=1&amp;h=2"></head>';
    expect(metaContent(withEntities, ['og:image'])).toBe('https://x.example/a.jpg?w=1&h=2');
  });

  it('преживява страница без мета тагове', () => {
    expect(metaContent('<html><body>нищо</body></html>', ['og:image'])).toBeNull();
  });

  it('приема единични кавички и липсващи кавички', () => {
    expect(metaContent("<head><meta property='og:image' content='https://a.bg/x.jpg'></head>", ['og:image'])).toBe(
      'https://a.bg/x.jpg',
    );
    expect(metaContent('<head><meta property=og:image content=https://b.bg/y.jpg></head>', ['og:image'])).toBe(
      'https://b.bg/y.jpg',
    );
  });
});

describe('Начало на деня в българско време', () => {
  it('полунощ в София, не в UTC', () => {
    // 7 август 2026, 00:30 UTC = 03:30 в София (лятно време).
    // Началото на българския ден е 6 август 21:00 UTC.
    const midnightSofia = startOfDay(new Date('2026-08-07T00:30:00Z'), 'Europe/Sofia');
    expect(midnightSofia.toISOString()).toBe('2026-08-06T21:00:00.000Z');
  });

  it('зимно време дава друго отместване', () => {
    // 15 януари 2026, 10:00 UTC = 12:00 в София (зимно време, +2).
    const midnight = startOfDay(new Date('2026-01-15T10:00:00Z'), 'Europe/Sofia');
    expect(midnight.toISOString()).toBe('2026-01-14T22:00:00.000Z');
  });

  it('два момента от един български ден дават едно начало', () => {
    const morning = startOfDay(new Date('2026-08-07T05:00:00Z'), 'Europe/Sofia');
    const evening = startOfDay(new Date('2026-08-07T20:00:00Z'), 'Europe/Sofia');
    expect(morning.getTime()).toBe(evening.getTime());
  });
});
