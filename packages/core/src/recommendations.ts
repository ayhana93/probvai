/**
 * ПРЕДЛОЖЕНИЯ ЗА ПОКУПКА
 *
 * ═══ ЗАЩО ГИ ИМА ═══
 *
 * Приложението не е генератор на снимки, а помощник за пазаруване. Човек,
 * който е видял как му стои една дреха, е на една стъпка от това да я купи —
 * и точно тогава е моментът да му покажем къде. Всяка минута след това
 * стойността пада.
 *
 * Затова предложения има на две места:
 *   • след готова визия — „Купи тази дреха" и какво върви с нея;
 *   • по време на чакането — екранът за зареждане не бива да е празен.
 *     Двайсет секунди чакане на празен екран са загубени; същите двайсет
 *     секунди с идеи носят кликове.
 *
 * ═══ ЧЕСТНО ЗА ТОВА, КОЕТО ПРЕДЛАГАМЕ ═══
 *
 * Нямаме продуктов фийд и не се преструваме, че имаме. „Най-продавани" и
 * „в тренд" не са измислени бройки — те са входове към търсене в магазините
 * ни партньори, съставени от категорията на визията и от пола. Връзката е
 * истинска, партньорската комисиона е истинска, а числата, които не знаем,
 * не се показват.
 *
 * Когато има продуктов фийд, се сменя само `blocksFor` — интерфейсът остава.
 */

import type { Gender, StyleCategory } from '@probvai/db';
import { MERCHANTS, merchantFor, affiliateUrl, searchUrl } from './merchants';
import { STYLE_INFO } from './style';

export type RecoKind = 'THIS' | 'SIMILAR' | 'SHOES' | 'BAGS' | 'ACCESSORIES';

export type RecoLink = {
  merchant: string;
  url: string;
};

export type RecoBlock = {
  kind: RecoKind;
  title: string;
  emoji: string;
  links: RecoLink[];
};

export type RecoInput = {
  category: StyleCategory | null;
  gender: Gender | null;
  /** Адресът на самата дреха, ако е дошла през линк. */
  productUrl?: string | null;
  merchant?: string | null;
};

/**
 * Думите за търсене се сглобяват на български — магазините ни работят на
 * български пазар и техните каталози са индексирани така.
 */
const GENDER_WORD: Record<Gender, string> = {
  MALE: 'мъжки',
  FEMALE: 'дамски',
  // Без дума. Търсене без пол дава по-широк резултат, а не празен.
  OTHER: '',
};

/** По какво се търси за всяка категория. */
const CATEGORY_WORDS: Record<StyleCategory, string> = {
  BUSINESS: 'официално сако',
  STREETWEAR: 'oversize суитшърт',
  LUXURY: 'кашмир палто',
  SUMMER: 'лятна рокля',
  ELEGANT: 'вечерна рокля',
  CUTE: 'рокля на цветя',
  GYM: 'спортен комплект',
  WEDDING: 'официална рокля',
  PARTY: 'парти рокля',
  CASUAL: 'дънки',
  DATE: 'елегантна блуза',
};

const KIND_WORDS: Record<Exclude<RecoKind, 'THIS'>, string> = {
  SIMILAR: '',
  SHOES: 'обувки',
  BAGS: 'чанта',
  ACCESSORIES: 'аксесоари',
};

const KIND_TITLE: Record<RecoKind, { title: string; emoji: string }> = {
  THIS: { title: 'Купи тази дреха', emoji: '🛍️' },
  SIMILAR: { title: 'Подобни продукти', emoji: '✨' },
  SHOES: { title: 'Подходящи обувки', emoji: '👟' },
  BAGS: { title: 'Подходящи чанти', emoji: '👜' },
  ACCESSORIES: { title: 'Подходящи аксесоари', emoji: '💍' },
};

function query(kind: Exclude<RecoKind, 'THIS'>, input: RecoInput): string {
  const gender = input.gender ? GENDER_WORD[input.gender] : '';
  const category = input.category ? CATEGORY_WORDS[input.category] : 'дрехи';
  const kindWord = KIND_WORDS[kind];

  // За обувки, чанти и аксесоари категорията е излишна — „парти обувки"
  // работи, „парти рокля обувки" не работи никъде.
  const core = kindWord ? kindWord : category;
  const style = kindWord && input.category ? styleWord(input.category) : '';

  return [gender, style, core].filter(Boolean).join(' ');
}

/** Едносрична дума за стила, за да не става търсенето изречение. */
function styleWord(category: StyleCategory): string {
  switch (category) {
    case 'BUSINESS':
      return 'официални';
    case 'GYM':
      return 'спортни';
    case 'SUMMER':
      return 'летни';
    case 'PARTY':
    case 'ELEGANT':
    case 'WEDDING':
      return 'елегантни';
    default:
      return '';
  }
}

/** Магазините, които участват в препоръките — само тези с проверено търсене. */
function searchableMerchants() {
  return MERCHANTS.filter((merchant) => Boolean(merchant.search));
}

function linksFor(kind: Exclude<RecoKind, 'THIS'>, input: RecoInput, take = 3): RecoLink[] {
  const q = query(kind, input);

  return searchableMerchants()
    .slice(0, take)
    .map((merchant) => {
      const url = searchUrl(merchant, q);
      return url ? { merchant: merchant.name, url } : null;
    })
    .filter((link): link is RecoLink => link !== null);
}

/**
 * Блоковете, които се показват под готовата визия.
 *
 * „Купи тази дреха" го има само когато НАИСТИНА знаем адреса ѝ — тоест
 * когато е дошла през линк. При качена снимка нямаме откъде да знаем коя е
 * дрехата, а предположение, представено като факт, е по-лошо от липсващ блок.
 */
export function blocksFor(input: RecoInput): RecoBlock[] {
  const blocks: RecoBlock[] = [];

  if (input.productUrl) {
    let merchant = null;
    try {
      merchant = merchantFor(new URL(input.productUrl).hostname);
    } catch {
      merchant = null;
    }

    blocks.push({
      kind: 'THIS',
      ...KIND_TITLE.THIS,
      links: [
        {
          merchant: merchant?.name ?? input.merchant ?? 'Магазина',
          url: affiliateUrl(input.productUrl, merchant),
        },
      ],
    });
  }

  for (const kind of ['SIMILAR', 'SHOES', 'BAGS', 'ACCESSORIES'] as const) {
    const links = linksFor(kind, input);
    if (links.length > 0) {
      blocks.push({ kind, ...KIND_TITLE[kind], links });
    }
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Екранът за чакане
// ---------------------------------------------------------------------------

export type WaitCard = {
  id: string;
  /** Надпис отгоре: „В тренд", „Идея". */
  tag: string;
  title: string;
  body: string;
  /** Има ли връзка към магазин. Съветите нямат — и това е нарочно. */
  url?: string;
  merchant?: string;
};

/**
 * Съвети, които не продават нищо.
 *
 * Всяка втора карта е съвет, а не оферта. Екран, на който всичко е реклама,
 * се научава да се пропуска с очи за два дни — и после нищо от него не
 * работи, включително офертите.
 */
const TIPS: { title: string; body: string }[] = [
  {
    title: 'Едно ярко на цял тоалет',
    body: 'Ако горнището е шарено, долнището е чисто. Две шарки се бият и никоя не печели.',
  },
  {
    title: 'Дължината решава',
    body: 'Панталон, който свършва на глезена, удължава крака. Един сантиметър по-дълъг го скъсява.',
  },
  {
    title: 'Три цвята, не повече',
    body: 'Обувките и чантата може да са в един тон — това връзва целия тоалет без усилие.',
  },
  {
    title: 'Пробвай с обувките, с които ще излезеш',
    body: 'Един и същ панталон изглежда различно с маратонки и с ток.',
  },
  {
    title: 'Черното не е единственият безопасен избор',
    body: 'Тъмносиньото и графитеното вършат същата работа и не изглеждат толкова строго.',
  },
];

/**
 * Картите, с които се пълни екранът за чакане.
 *
 * Редуват се: оферта, съвет, оферта, съвет. Чакането е двайсет до шейсет
 * секунди — толкова стигат за пет-шест карти.
 */
export function waitCards(input: RecoInput): WaitCard[] {
  const cards: WaitCard[] = [];
  const merchants = searchableMerchants();

  const offers: { tag: string; label: string; kind: Exclude<RecoKind, 'THIS'> }[] = [
    { tag: 'В тренд', label: 'Търсено тази седмица', kind: 'SIMILAR' },
    { tag: 'Върви с това', label: 'Обувки към визията', kind: 'SHOES' },
    { tag: 'Върви с това', label: 'Чанта към визията', kind: 'BAGS' },
  ];

  offers.forEach((offer, index) => {
    const merchant = merchants[index % Math.max(1, merchants.length)];
    if (!merchant) return;

    const url = searchUrl(merchant, query(offer.kind, input));
    if (!url) return;

    const style = input.category ? STYLE_INFO[input.category] : null;

    cards.push({
      id: `offer-${offer.kind}`,
      tag: offer.tag,
      title: offer.label,
      body: style
        ? `${style.emoji} ${style.label} · ${merchant.name}`
        : merchant.name,
      url,
      merchant: merchant.name,
    });

    const tip = TIPS[index % TIPS.length];
    if (tip) {
      cards.push({ id: `tip-${index}`, tag: 'Идея', title: tip.title, body: tip.body });
    }
  });

  // Без нито един магазин с проверено търсене остават само съветите.
  // По-добре екран със съвети, отколкото празен екран.
  if (cards.length === 0) {
    return TIPS.map((tip, index) => ({
      id: `tip-${index}`,
      tag: 'Идея',
      title: tip.title,
      body: tip.body,
    }));
  }

  return cards;
}
