/**
 * ЗАЩИТА ОТ SSRF
 *
 * `/api/extract-garment` приема адрес от потребителката и го изтегля от
 * нашия сървър. Без защита това е дупка, през която всеки може да накара
 * сървъра ни да отвори каквото си поиска във вътрешната мрежа — метаданните
 * на облака, вътрешни админ панели, самата база.
 *
 * ═══ ЗАЩО ПРОВЕРКА НА ИМЕТО НЕ Е ДОСТАТЪЧНА ═══
 *
 * Наивната защита резолвира името, вижда публичен адрес и пуска заявката.
 * Но между проверката и свързването атакуващият сменя DNS записа към
 * 169.254.169.254 — това се казва DNS rebinding и минава през такава защита
 * като през масло.
 *
 * Затова тук проверката е при САМОТО СВЪРЗВАНЕ: подаваме на undici
 * собствена `lookup` функция, която връща грешка, ако разрешеният адрес е
 * частен. Няма прозорец между проверката и връзката, защото това е една и
 * съща стъпка.
 *
 * Отгоре: само http/https, ръчно следене на пренасочванията с проверка на
 * всяка стъпка, таймаут и таван на размера.
 */

import { lookup as dnsLookup } from 'node:dns';
import { isIP } from 'node:net';
import { Agent, fetch as undiciFetch, type Dispatcher } from 'undici';

export type BlockedReason =
  | 'BAD_URL'
  | 'BAD_SCHEME'
  | 'PRIVATE_ADDRESS'
  | 'DNS_FAILED'
  | 'TOO_MANY_REDIRECTS'
  | 'TOO_LARGE'
  | 'TIMEOUT'
  | 'FETCH_FAILED'
  | 'BAD_CONTENT_TYPE';

export class BlockedRequestError extends Error {
  constructor(
    readonly reason: BlockedReason,
    message: string,
  ) {
    super(message);
    this.name = 'BlockedRequestError';
  }
}

// ---------------------------------------------------------------------------
// Кои адреси са забранени
// ---------------------------------------------------------------------------

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;

  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value >>> 0;
}

/** CIDR блокове, до които сървърът няма работа да ходи. */
const BLOCKED_V4: [string, number][] = [
  ['0.0.0.0', 8], // „този хост"
  ['10.0.0.0', 8], // частна мрежа
  ['100.64.0.0', 10], // CGNAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, вкл. метаданните на облака
  ['172.16.0.0', 12], // частна мрежа
  ['192.0.0.0', 24], // служебни
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.168.0.0', 16], // частна мрежа
  ['198.18.0.0', 15], // тестове на производителност
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // запазени
];

export function isPrivateIPv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  if (value === null) return true; // не можем да го разчетем → не му вярваме

  for (const [base, bits] of BLOCKED_V4) {
    const baseValue = ipv4ToInt(base);
    if (baseValue === null) continue;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    if ((value & mask) === (baseValue & mask)) return true;
  }
  return false;
}

export function isPrivateIPv6(ip: string): boolean {
  const address = ip.toLowerCase().split('%')[0] ?? '';

  if (address === '::' || address === '::1') return true;

  // IPv4, увит в IPv6: ::ffff:127.0.0.1 — проверява се като IPv4.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(address);
  if (mapped?.[1]) return isPrivateIPv4(mapped[1]);

  // ::ffff:7f00:1 — същото, но записано шестнайсетично.
  const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(address);
  if (mappedHex?.[1] && mappedHex[2]) {
    const high = Number.parseInt(mappedHex[1], 16);
    const low = Number.parseInt(mappedHex[2], 16);
    const asV4 = [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
    return isPrivateIPv4(asV4);
  }

  const firstGroup = address.split(':')[0] ?? '';
  const prefix = Number.parseInt(firstGroup.padStart(4, '0'), 16);
  if (Number.isNaN(prefix)) return true;

  if ((prefix & 0xfe00) === 0xfc00) return true; // fc00::/7 частни
  if ((prefix & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((prefix & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (address.startsWith('2001:db8:')) return true; // за документация
  if (address.startsWith('64:ff9b:')) return true; // NAT64

  return false;
}

export function isPrivateAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return true; // не е адрес → не му вярваме
}

// ---------------------------------------------------------------------------
// Свързване само към публични адреси
// ---------------------------------------------------------------------------

/**
 * Подменя резолвирането на имена в самия момент на свързването.
 * Ако адресът е частен, връща грешка и връзка изобщо не се отваря.
 */
const guardedLookup: typeof dnsLookup = ((
  hostname: string,
  options: unknown,
  callback: (error: NodeJS.ErrnoException | null, ...args: unknown[]) => void,
) => {
  const done = typeof options === 'function' ? (options as typeof callback) : callback;
  const opts = typeof options === 'function' ? {} : (options as object);

  dnsLookup(hostname, { ...opts, all: true } as never, (error, addresses) => {
    if (error) {
      done(error);
      return;
    }

    const list = (addresses as unknown as { address: string; family: number }[]) ?? [];
    if (list.length === 0) {
      done(new Error(`Няма адрес за ${hostname}`));
      return;
    }

    // Достатъчно е ЕДИН от адресите да е частен, за да откажем всичко.
    // Атакуващият не бива да може да избира кой запис ще хванем.
    for (const entry of list) {
      if (isPrivateAddress(entry.address)) {
        done(
          new BlockedRequestError(
            'PRIVATE_ADDRESS',
            `${hostname} сочи към частен адрес ${entry.address}`,
          ),
        );
        return;
      }
    }

    const first = list[0]!;
    if (typeof options !== 'function' && (options as { all?: boolean }).all) {
      done(null, list);
    } else {
      done(null, first.address, first.family);
    }
  });
}) as typeof dnsLookup;

let agent: Agent | undefined;

function guardedAgent(): Agent {
  agent ??= new Agent({
    connect: { lookup: guardedLookup },
    connectTimeout: 5_000,
  });
  return agent;
}

// ---------------------------------------------------------------------------
// Проверка на самия адрес
// ---------------------------------------------------------------------------

export function parsePublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new BlockedRequestError('BAD_URL', 'Това не е валиден адрес.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BlockedRequestError('BAD_SCHEME', 'Приемаме само http и https адреси.');
  }

  // Адрес, записан направо с IP — проверява се веднага, без DNS.
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && isPrivateAddress(host)) {
    throw new BlockedRequestError('PRIVATE_ADDRESS', 'Този адрес сочи навътре в мрежата.');
  }

  return url;
}

// ---------------------------------------------------------------------------
// Изтегляне
// ---------------------------------------------------------------------------

export type SafeFetchOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  accept?: string;
  /** Приемливи начала на content-type. Празно = всичко. */
  allowedContentTypes?: string[];
  /**
   * САМО ЗА ТЕСТОВЕ. Подменя транспорта, за да може да се провери следенето
   * на пренасочванията и таваните без истинска мрежа.
   *
   * Проверката на адресите НЕ минава оттук — тя е в `parsePublicUrl` и в
   * `guardedLookup` и важи и при подменен транспорт.
   */
  transport?: typeof undiciFetch;
};

export type SafeFetchResult = {
  url: string;
  contentType: string;
  body: Uint8Array;
};

const DEFAULTS = {
  timeoutMs: 5_000,
  maxBytes: 2 * 1024 * 1024,
  maxRedirects: 3,
};

/**
 * Изтегля адрес, като проверява всяко пренасочване поотделно и спира
 * четенето, щом тялото мине лимита.
 */
export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;
  const maxBytes = options.maxBytes ?? DEFAULTS.maxBytes;
  const maxRedirects = options.maxRedirects ?? DEFAULTS.maxRedirects;

  let current = parsePublicUrl(rawUrl);
  const deadline = Date.now() + timeoutMs;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new BlockedRequestError('TIMEOUT', 'Магазинът не отговори навреме.');
    }

    const transport = options.transport ?? undiciFetch;

    let response: Awaited<ReturnType<typeof undiciFetch>>;
    try {
      response = await transport(current.toString(), {
        method: 'GET',
        redirect: 'manual',
        dispatcher: guardedAgent() as unknown as Dispatcher,
        signal: AbortSignal.timeout(remaining),
        headers: {
          // Представяме се като обикновен браузър — иначе много магазини
          // връщат празна страница.
          'user-agent':
            'Mozilla/5.0 (compatible; ProbvaiBot/1.0; +https://probvai.bg/bot)',
          accept: options.accept ?? 'text/html,application/xhtml+xml',
          'accept-language': 'bg-BG,bg;q=0.9,en;q=0.8',
        },
      });
    } catch (error) {
      if (error instanceof BlockedRequestError) throw error;
      // Грешката от `guardedLookup` идва обвита в причината.
      const cause = (error as { cause?: unknown }).cause;
      if (cause instanceof BlockedRequestError) throw cause;
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new BlockedRequestError('TIMEOUT', 'Магазинът не отговори навреме.');
      }
      throw new BlockedRequestError(
        'FETCH_FAILED',
        `Не успях да отворя адреса: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // ── Пренасочване ────────────────────────────────────────────────────
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.body?.cancel().catch(() => {});

      if (!location) {
        throw new BlockedRequestError('FETCH_FAILED', 'Празно пренасочване.');
      }
      if (hop === maxRedirects) {
        throw new BlockedRequestError('TOO_MANY_REDIRECTS', 'Твърде много пренасочвания.');
      }

      // Новият адрес минава пълната проверка отначало.
      current = parsePublicUrl(new URL(location, current).toString());
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new BlockedRequestError(
        'FETCH_FAILED',
        `Магазинът отговори с ${response.status}.`,
      );
    }

    const contentType = (response.headers.get('content-type') ?? '').toLowerCase();

    if (options.allowedContentTypes?.length) {
      const allowed = options.allowedContentTypes.some((prefix) =>
        contentType.startsWith(prefix),
      );
      if (!allowed) {
        await response.body?.cancel().catch(() => {});
        throw new BlockedRequestError(
          'BAD_CONTENT_TYPE',
          `Неочакван вид съдържание: ${contentType || 'липсва'}`,
        );
      }
    }

    // Заявеният размер вече е над лимита — не си правим труда да четем.
    const declared = Number(response.headers.get('content-length') ?? '0');
    if (declared > maxBytes) {
      await response.body?.cancel().catch(() => {});
      throw new BlockedRequestError('TOO_LARGE', 'Файлът е прекалено голям.');
    }

    const body = await readCapped(response, maxBytes);
    return { url: current.toString(), contentType, body };
  }

  throw new BlockedRequestError('TOO_MANY_REDIRECTS', 'Твърде много пренасочвания.');
}

/**
 * Чете тялото на парчета и спира веднага щом мине лимита.
 * `content-length` може да лъже — това не може.
 */

/** Минималният вид, който ни трябва — така работи и с undici, и с DOM типовете. */
type StreamingBody = {
  body: {
    getReader(): {
      read(): Promise<{ done: boolean; value?: Uint8Array | undefined }>;
      releaseLock(): void;
    };
    cancel(): Promise<void>;
  } | null;
};

async function readCapped(
  response: StreamingBody,
  maxBytes: number,
): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array(0);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.length;
      if (total > maxBytes) {
        throw new BlockedRequestError('TOO_LARGE', 'Файлът е прекалено голям.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
    await response.body.cancel().catch(() => {});
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
