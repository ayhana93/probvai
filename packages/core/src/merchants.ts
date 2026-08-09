/**
 * МАГАЗИНИТЕ, КОИТО РАЗПОЗНАВАМЕ
 *
 * Разпознаването върши две неща: показва името на магазина в интерфейса и
 * позволява да сложим партньорска връзка към бутона „Купи я".
 *
 * Непознат магазин НЕ е грешка — снимката се извлича по същия начин, просто
 * без партньорска връзка.
 */

import { env } from './env';

export type AffiliateNetwork = 'admitad' | 'awin' | 'profitshare';

export type Merchant = {
  /** Домейнът, по който разпознаваме. Поддомейните се хващат също. */
  domain: string;
  name: string;
  network: AffiliateNetwork | null;
  /**
   * Адрес за търсене в магазина. `{q}` се заменя с думите за търсене.
   *
   * ⚠ ПРОВЕРИ ВСЕКИ ЕДИН ПРЕДИ ПУСКАНЕ. Магазините сменят адресите си без
   * предупреждение, а счупена връзка от препоръка е по-лоша от липсваща.
   * Оставиш ли полето празно, магазинът просто не участва в препоръките —
   * нищо не се чупи.
   */
  search?: string;
};

export const MERCHANTS: Merchant[] = [
  {
    domain: 'shein.com',
    name: 'Shein',
    network: 'admitad',
    search: 'https://bg.shein.com/pdsearch/{q}/',
  },
  {
    domain: 'vinted.bg',
    name: 'Vinted',
    network: null,
    search: 'https://www.vinted.bg/catalog?search_text={q}',
  },
  {
    domain: 'about-you.bg',
    name: 'About You',
    network: 'awin',
    search: 'https://www.about-you.bg/search?term={q}',
  },
  {
    domain: 'answear.bg',
    name: 'Answear',
    network: 'admitad',
    search: 'https://answear.bg/search?query={q}',
  },
  {
    domain: 'zalando.bg',
    name: 'Zalando',
    network: 'awin',
    search: 'https://www.zalando.bg/catalog/?q={q}',
  },
  {
    domain: 'emag.bg',
    name: 'eMAG',
    network: 'profitshare',
    search: 'https://www.emag.bg/search/{q}',
  },
];

/**
 * Търси магазина по име на хост. Хваща и поддомейните:
 * `bg.shein.com` и `www.shein.com` водят до Shein.
 */
export function merchantFor(hostname: string): Merchant | null {
  const host = hostname.toLowerCase().replace(/^www\./, '');

  for (const merchant of MERCHANTS) {
    if (host === merchant.domain || host.endsWith(`.${merchant.domain}`)) {
      return merchant;
    }
  }
  return null;
}

/**
 * Шаблоните за партньорските мрежи идват от средата, защото съдържат
 * нашите идентификатори и се различават за всяка програма.
 *
 *   AFFILIATE_ADMITAD_TEMPLATE=https://ad.admitad.com/g/ХХХ/?ulp={url}
 *   AFFILIATE_AWIN_TEMPLATE=https://www.awin1.com/cread.php?awinmid=Х&awinaffid=Y&ued={url}
 *   AFFILIATE_PROFITSHARE_TEMPLATE=https://profitshare.bg/l/ХХХ?url={url}
 *
 * `{url}` се заменя с адреса на продукта, кодиран за адрес.
 */
function templateFor(network: AffiliateNetwork): string | undefined {
  switch (network) {
    case 'admitad':
      return env.AFFILIATE_ADMITAD_TEMPLATE;
    case 'awin':
      return env.AFFILIATE_AWIN_TEMPLATE;
    case 'profitshare':
      return env.AFFILIATE_PROFITSHARE_TEMPLATE;
  }
}

/**
 * Прави партньорска връзка. Ако мрежата няма настроен шаблон, връща
 * оригиналния адрес — бутонът „Купи я" винаги работи, дори без партньорство.
 */
export function affiliateUrl(productUrl: string, merchant: Merchant | null): string {
  if (!merchant?.network) return productUrl;

  const template = templateFor(merchant.network);
  if (!template || !template.includes('{url}')) return productUrl;

  return template.replace('{url}', encodeURIComponent(productUrl));
}

/**
 * Адрес за търсене в магазина, вече през партньорската мрежа.
 * Връща `null`, ако магазинът няма проверен адрес за търсене — по-добре без
 * връзка, отколкото със счупена.
 */
export function searchUrl(merchant: Merchant, query: string): string | null {
  if (!merchant.search) return null;
  const target = merchant.search.replace('{q}', encodeURIComponent(query));
  return affiliateUrl(target, merchant);
}
