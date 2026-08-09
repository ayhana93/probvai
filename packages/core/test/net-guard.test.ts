/**
 * ЗАЩИТА ОТ SSRF
 *
 * Покрива точката от контролния списък:
 *   „/api/extract-garment отхвърля http://127.0.0.1 и http://192.168.1.1"
 *
 * Проверява и по-коварните случаи: метаданните на облака, адреси, записани
 * като десетично число, IPv4 увит в IPv6, и пренасочване от публичен адрес
 * към вътрешен.
 */

import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  BlockedRequestError,
  isPrivateAddress,
  isPrivateIPv4,
  isPrivateIPv6,
  parsePublicUrl,
  safeFetch,
} from '../src/net-guard';

describe('Разпознаване на частни адреси', () => {
  it('отхвърля всички частни диапазони от заданието', () => {
    for (const ip of [
      '10.0.0.1',
      '10.255.255.255',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.0.1',
      '192.168.1.1',
      '127.0.0.1',
      '127.1.2.3',
      '169.254.169.254', // метаданните на облака — най-важният случай
      '0.0.0.0',
    ]) {
      expect(isPrivateIPv4(ip), ip).toBe(true);
    }
  });

  it('отхвърля и диапазоните, които заданието не изброява', () => {
    for (const ip of [
      '100.64.0.1', // CGNAT — в България го ползват мобилните оператори
      '192.0.0.1',
      '198.18.0.1',
      '224.0.0.1', // multicast
      '240.0.0.1', // запазени
    ]) {
      expect(isPrivateIPv4(ip), ip).toBe(true);
    }
  });

  it('пуска истински публични адреси', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '104.16.0.1', '172.15.0.1', '172.32.0.1']) {
      expect(isPrivateIPv4(ip), ip).toBe(false);
    }
  });

  it('хваща границите на 172.16/12 точно', () => {
    expect(isPrivateIPv4('172.15.255.255')).toBe(false);
    expect(isPrivateIPv4('172.16.0.0')).toBe(true);
    expect(isPrivateIPv4('172.31.255.255')).toBe(true);
    expect(isPrivateIPv4('172.32.0.0')).toBe(false);
  });

  it('отхвърля частните IPv6 адреси', () => {
    for (const ip of ['::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1']) {
      expect(isPrivateIPv6(ip), ip).toBe(true);
    }
    expect(isPrivateIPv6('2606:4700::1111')).toBe(false);
  });

  it('не се подлъгва по IPv4, увит в IPv6', () => {
    expect(isPrivateIPv6('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateIPv6('::ffff:169.254.169.254')).toBe(true);
    expect(isPrivateIPv6('::ffff:7f00:1')).toBe(true); // 127.0.0.1 шестнайсетично
    expect(isPrivateIPv6('::ffff:8.8.8.8')).toBe(false);
  });

  it('не вярва на нещо, което не е адрес', () => {
    expect(isPrivateAddress('не-е-адрес')).toBe(true);
    expect(isPrivateAddress('')).toBe(true);
  });
});

describe('parsePublicUrl', () => {
  it('отхвърля точно адресите от контролния списък', () => {
    expect(() => parsePublicUrl('http://127.0.0.1')).toThrow(BlockedRequestError);
    expect(() => parsePublicUrl('http://192.168.1.1')).toThrow(BlockedRequestError);
  });

  it('отхвърля метаданните на облака', () => {
    expect(() => parsePublicUrl('http://169.254.169.254/latest/meta-data/')).toThrow(
      BlockedRequestError,
    );
  });

  it('отхвърля IPv6 loopback', () => {
    expect(() => parsePublicUrl('http://[::1]:8080/')).toThrow(BlockedRequestError);
  });

  it('отхвърля схеми, които не са http или https', () => {
    for (const url of [
      'file:///etc/passwd',
      'ftp://example.com/x',
      'gopher://example.com',
      'data:text/html,<h1>x</h1>',
    ]) {
      expect(() => parsePublicUrl(url), url).toThrow(BlockedRequestError);
    }
  });

  it('отхвърля безсмислен вход', () => {
    expect(() => parsePublicUrl('просто текст')).toThrow(BlockedRequestError);
    expect(() => parsePublicUrl('')).toThrow(BlockedRequestError);
  });

  it('пуска нормални адреси на магазини', () => {
    expect(parsePublicUrl('https://www.shein.com/x-p-123.html').hostname).toBe(
      'www.shein.com',
    );
    expect(parsePublicUrl('  https://zalando.bg/nesto  ').hostname).toBe('zalando.bg');
  });
});

describe('safeFetch срещу истинска мрежа', () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html><head><meta property="og:image" content="x"></head></html>');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as { port: number }).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('не стига до сървър на 127.0.0.1, макар да е вдигнат', async () => {
    await expect(safeFetch(`http://127.0.0.1:${port}/`)).rejects.toMatchObject({
      reason: 'PRIVATE_ADDRESS',
    });
  });

  it('не стига и когато адресът е скрит зад име', async () => {
    // `localhost` резолвира към 127.0.0.1 — проверката е при свързването,
    // не при четенето на адреса.
    await expect(safeFetch(`http://localhost:${port}/`)).rejects.toMatchObject({
      reason: 'PRIVATE_ADDRESS',
    });
  });
});

describe('safeFetch — пренасочвания и тавани', () => {
  /** Подставка на транспорта. Проверката на адресите пак важи. */
  function fakeTransport(
    responses: Record<string, { status: number; headers?: Record<string, string>; body?: string }>,
  ) {
    return (async (url: string) => {
      const spec = responses[String(url)];
      if (!spec) throw new Error(`Няма подготвен отговор за ${url}`);

      const body = spec.body ?? '';
      return new Response(body, {
        status: spec.status,
        headers: { 'content-type': 'text/html', ...spec.headers },
      });
    }) as never;
  }

  it('следва пренасочване към публичен адрес', async () => {
    const result = await safeFetch('https://shop.example/a', {
      transport: fakeTransport({
        'https://shop.example/a': {
          status: 302,
          headers: { location: 'https://shop.example/b' },
        },
        'https://shop.example/b': { status: 200, body: '<html>краен</html>' },
      }),
    });

    expect(result.url).toBe('https://shop.example/b');
    expect(new TextDecoder().decode(result.body)).toContain('краен');
  });

  it('СПИРА пренасочване към вътрешен адрес', async () => {
    await expect(
      safeFetch('https://shop.example/a', {
        transport: fakeTransport({
          'https://shop.example/a': {
            status: 302,
            headers: { location: 'http://169.254.169.254/latest/meta-data/' },
          },
        }),
      }),
    ).rejects.toMatchObject({ reason: 'PRIVATE_ADDRESS' });
  });

  it('СПИРА пренасочване към 127.0.0.1', async () => {
    await expect(
      safeFetch('https://shop.example/a', {
        transport: fakeTransport({
          'https://shop.example/a': {
            status: 301,
            headers: { location: 'http://127.0.0.1:5432/' },
          },
        }),
      }),
    ).rejects.toMatchObject({ reason: 'PRIVATE_ADDRESS' });
  });

  it('спира безкрайна верига от пренасочвания', async () => {
    await expect(
      safeFetch('https://shop.example/loop', {
        maxRedirects: 2,
        transport: fakeTransport({
          'https://shop.example/loop': {
            status: 302,
            headers: { location: 'https://shop.example/loop' },
          },
        }),
      }),
    ).rejects.toMatchObject({ reason: 'TOO_MANY_REDIRECTS' });
  });

  it('отказва обявен размер над тавана', async () => {
    await expect(
      safeFetch('https://shop.example/big', {
        maxBytes: 1000,
        transport: fakeTransport({
          'https://shop.example/big': {
            status: 200,
            headers: { 'content-length': '99999999' },
          },
        }),
      }),
    ).rejects.toMatchObject({ reason: 'TOO_LARGE' });
  });

  it('отказва тяло над тавана, дори когато content-length лъже', async () => {
    await expect(
      safeFetch('https://shop.example/liar', {
        maxBytes: 100,
        transport: fakeTransport({
          'https://shop.example/liar': {
            status: 200,
            headers: { 'content-length': '10' },
            body: 'x'.repeat(5000),
          },
        }),
      }),
    ).rejects.toMatchObject({ reason: 'TOO_LARGE' });
  });

  it('отказва неочакван вид съдържание', async () => {
    await expect(
      safeFetch('https://shop.example/zip', {
        allowedContentTypes: ['text/html'],
        transport: fakeTransport({
          'https://shop.example/zip': {
            status: 200,
            headers: { 'content-type': 'application/zip' },
          },
        }),
      }),
    ).rejects.toMatchObject({ reason: 'BAD_CONTENT_TYPE' });
  });
});
