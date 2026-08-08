/**
 * СТИЛОВИ КАТЕГОРИИ
 *
 * Всяка визия се нарежда автоматично в една категория. Причината не е
 * подредба заради подредбата: гардероб от 60 снимки без категории е камара,
 * а камара не се разглежда. Категориите правят от нея Lookbook — и то без
 * човекът да е пипнал нищо.
 *
 * ═══ ЧЕСТНО ЗА „AI КАТЕГОРИЗИРАНЕТО" ═══
 *
 * Тук няма модел, който гледа снимката. Има правила върху текста, който
 * НАИСТИНА знаем: заглавието на продукта и адреса му, когато дрехата е
 * дошла през линк от магазин. Това покрива точно случая, в който имаме
 * данни, и не си измисля в случая, в който нямаме.
 *
 * Когато дрехата е качена като снимка, текст няма. Тогава категорията се
 * пада по сезон — и човекът я сменя с едно натискане. По-добре разумно
 * предположение, което се поправя, отколкото празно поле, което никой не
 * попълва.
 *
 * `classifyByVision` е мястото, където се закача истински модел. Докато го
 * няма, функцията връща `null` и правилата поемат. Подмяната ѝ не пипа нищо
 * друго в системата.
 */

import type { StyleCategory } from '@probvai/db';

export const STYLE_CATEGORIES = [
  'BUSINESS',
  'STREETWEAR',
  'LUXURY',
  'SUMMER',
  'ELEGANT',
  'CUTE',
  'GYM',
  'WEDDING',
  'PARTY',
  'CASUAL',
  'DATE',
] as const satisfies readonly StyleCategory[];

export type StyleInfo = {
  category: StyleCategory;
  label: string;
  emoji: string;
};

/** Как се казва всяка категория на екрана. */
export const STYLE_INFO: Record<StyleCategory, StyleInfo> = {
  BUSINESS: { category: 'BUSINESS', label: 'Бизнес', emoji: '👔' },
  STREETWEAR: { category: 'STREETWEAR', label: 'Стрийт', emoji: '🖤' },
  LUXURY: { category: 'LUXURY', label: 'Лукс', emoji: '💎' },
  SUMMER: { category: 'SUMMER', label: 'Лято', emoji: '🌴' },
  ELEGANT: { category: 'ELEGANT', label: 'Елегантно', emoji: '🥂' },
  CUTE: { category: 'CUTE', label: 'Сладко', emoji: '🎀' },
  GYM: { category: 'GYM', label: 'Спорт', emoji: '🏋️' },
  WEDDING: { category: 'WEDDING', label: 'Сватба', emoji: '💍' },
  PARTY: { category: 'PARTY', label: 'Парти', emoji: '🌃' },
  CASUAL: { category: 'CASUAL', label: 'Ежедневно', emoji: '👟' },
  DATE: { category: 'DATE', label: 'Среща', emoji: '💌' },
};

export function isStyleCategory(value: unknown): value is StyleCategory {
  return (
    typeof value === 'string' &&
    (STYLE_CATEGORIES as readonly string[]).includes(value)
  );
}

/**
 * Думите, по които разпознаваме.
 *
 * Редът е важен: проверяваме отгоре надолу и спираме на първото попадение.
 * Затова специфичното стои преди общото — „булчинска рокля" е сватба, не
 * елегантно, макар да съдържа и двете.
 *
 * Списъкът е на български И на английски. Заглавията в Shein и Zalando са
 * на английски, тези в eMAG и Answear — на български, а често са смесени.
 */
const RULES: { category: StyleCategory; words: string[] }[] = [
  {
    category: 'WEDDING',
    words: ['булчинск', 'сватб', 'wedding', 'bridal', 'bride', 'кума', 'шаферк'],
  },
  {
    category: 'GYM',
    words: [
      'спорт', 'фитнес', 'тренир', 'легинс', 'анцуг', 'клин',
      'gym', 'fitness', 'training', 'legging', 'sportswear', 'yoga', 'workout',
      'jogger', 'tracksuit',
    ],
  },
  {
    category: 'BUSINESS',
    words: [
      'сако', 'костюм', 'официал', 'риза', 'делов', 'блейзър',
      'blazer', 'suit', 'formal', 'office', 'business', 'shirt', 'tailored',
      'waistcoat',
    ],
  },
  {
    category: 'WEDDING',
    // Абитуриентската рокля не е сватба, но живее в същия рафт.
    words: ['абитуриент', 'бал '],
  },
  {
    category: 'PARTY',
    words: [
      'парти', 'пайет', 'клубн', 'нощ',
      'party', 'sequin', 'glitter', 'club', 'night out', 'disco', 'metallic',
    ],
  },
  {
    category: 'LUXURY',
    words: [
      'коприн', 'кашмир', 'луксоз', 'кожен', 'естествена кожа',
      'silk', 'cashmere', 'luxury', 'premium', 'designer', 'leather', 'wool',
      'merino', 'satin',
    ],
  },
  {
    category: 'SUMMER',
    words: [
      'бански', 'плаж', 'летен', 'летн', 'лятн', 'сарафан', 'шорт', 'сандал',
      'swim', 'bikini', 'beach', 'summer', 'shorts', 'sundress', 'linen',
      'лен', 'tank top', 'потник',
    ],
  },
  {
    category: 'ELEGANT',
    words: [
      'елегант', 'вечер', 'коктейл',
      'elegant', 'evening', 'cocktail', 'gown', 'midi dress', 'maxi dress',
      'bodycon',
    ],
  },
  {
    category: 'CUTE',
    words: [
      'сладк', 'панделк', 'цветн принт', 'на цветя', 'дантел', 'пастел',
      'cute', 'bow', 'floral', 'lace', 'pastel', 'ruffle', 'волан', 'къдри',
    ],
  },
  {
    category: 'STREETWEAR',
    words: [
      'суитшърт', 'худи', 'оувърсайз', 'карго', 'маратонк', 'шапк',
      'hoodie', 'sweatshirt', 'oversize', 'cargo', 'sneaker', 'streetwear',
      'baggy', 'bomber', 'puffer', 'graphic tee',
    ],
  },
  {
    category: 'DATE',
    words: ['за среща', 'date night', 'romantic', 'романтич'],
  },
  {
    category: 'CASUAL',
    words: [
      'дънк', 'тениск', 'ежеднев', 'пуловер', 'блуза', 'суитчър',
      'jeans', 'denim', 't-shirt', 'tee', 'casual', 'sweater', 'knit',
      'cardigan', 'жилетк',
    ],
  },
];

export type CategorizeInput = {
  /** Заглавието на продукта от магазина, ако има такова. */
  title?: string | null;
  /** Адресът на продукта — в него често има категорията: /dresses/, /obuvki/. */
  productUrl?: string | null;
  /** Кога е направена визията. Ползва се само за сезонния резервен вариант. */
  at?: Date;
};

/**
 * Слага категория. Никога не връща `null` — визия без категория не се
 * показва никъде и все едно не съществува.
 */
export function categorize(input: CategorizeInput): StyleCategory {
  const haystack = [input.title ?? '', decodeUrlWords(input.productUrl)]
    .join(' ')
    .toLowerCase();

  if (haystack.trim().length > 0) {
    for (const rule of RULES) {
      if (rule.words.some((word) => haystack.includes(word))) {
        return rule.category;
      }
    }
  }

  return seasonFallback(input.at ?? new Date());
}

/**
 * Адресите носят категорията в пътя: `/women/dresses/summer-linen-dress-123`.
 * Тиретата и наклонените черти стават интервали, за да съвпадат думите.
 */
function decodeUrlWords(url: string | null | undefined): string {
  if (!url) return '';
  try {
    return decodeURIComponent(url).replace(/[/\-_+.]/g, ' ');
  } catch {
    return url.replace(/[/\-_+.]/g, ' ');
  }
}

/**
 * Резервният вариант, когато не знаем нищо за дрехата.
 *
 * Лятото е лято, зимата е ежедневно. Не е гениално — но е вярно по-често,
 * отколкото случайно, и се сменя с едно натискане.
 */
function seasonFallback(at: Date): StyleCategory {
  const month = at.getMonth() + 1;
  return month >= 6 && month <= 8 ? 'SUMMER' : 'CASUAL';
}

/**
 * Мястото за истински модел, който гледа снимката.
 *
 * Докато няма такъв, връща `null` и правилата поемат. Когато се появи,
 * се сменя само тялото на тази функция.
 */
export async function classifyByVision(
  _resultImage: Uint8Array,
): Promise<StyleCategory | null> {
  return null;
}
