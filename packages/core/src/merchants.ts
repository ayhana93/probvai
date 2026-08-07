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
};

export const MERCHANTS: Merchant[] = [
  { domain: 'shein.com', name: 'Shein', network: 'admitad' },
  { domain: 'vinted.bg', name: 'Vinted', network: null },
  { domain: 'about-you.bg', name: 'About You', network: 'awin' },
  { domain: 'answear.bg', name: 'Answear', network: 'admitad' },
  { domain: 'zalando.bg', name: 'Zalando', network: 'awin' },
  { domain: 'emag.bg', name: 'eMAG', network: 'profitshare' },
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
