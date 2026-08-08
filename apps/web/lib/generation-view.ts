/**
 * Общият вид, в който показваме генерация навън.
 *
 * Ползва се и от `GET /api/generate/{id}`, и от потока със събития.
 * Един източник — двата отговора не могат да се разминат.
 */

import {
  blocksFor,
  getSignedUrl,
  waitCards,
  type RecoBlock,
  type WaitCard,
} from '@probvai/core';
import { dbAsUser, type Gender, type GenSource, type StyleCategory } from '@probvai/db';

export type GenerationView = {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED' | 'REFUNDED';
  aspectRatio: string;
  watermarked: boolean;
  /** Качена снимка или линк от магазин. */
  source: GenSource;
  /** Име на магазин има САМО при линк — иначе не знаем от къде е дрехата. */
  merchant: string | null;
  category: StyleCategory | null;
  errorCode: string | null;
  createdAt: string;
  /** Секунди от създаването — интерфейсът показва брояча. */
  elapsedSeconds: number;
  /** Подписан адрес към резултата. Само когато е готов. */
  resultUrl: string | null;
  personUrl: string | null;
  /** Свалена ли е вече в галерията на телефона. */
  saved: boolean;
  /** Публикувана ли е в Lookbook. */
  published: boolean;
  /** Партньорските блокове под готовата визия. */
  recommendations: RecoBlock[];
  /** С какво се пълни екранът за чакане. */
  waiting: WaitCard[];
};

/**
 * Чете през `dbAsUser`, тоест през Row Level Security. Чужда генерация не
 * се вижда, дори id-то да е познато — базата не я връща.
 */
export async function loadGenerationView(
  userId: string,
  generationId: string,
): Promise<GenerationView | null> {
  const generation = await dbAsUser(userId).generation.findUnique({
    where: { id: generationId },
    select: {
      id: true,
      status: true,
      aspectRatio: true,
      watermarked: true,
      source: true,
      merchant: true,
      productUrl: true,
      category: true,
      personGender: true,
      savedAt: true,
      publishedAt: true,
      errorCode: true,
      resultKey: true,
      personKey: true,
      createdAt: true,
    },
  });

  if (!generation) return null;

  const [resultUrl, personUrl] = await Promise.all([
    generation.resultKey ? getSignedUrl(generation.resultKey) : Promise.resolve(null),
    generation.personKey ? getSignedUrl(generation.personKey) : Promise.resolve(null),
  ]);

  const reco = {
    category: generation.category,
    gender: generation.personGender as Gender | null,
    productUrl: generation.productUrl,
    merchant: generation.merchant,
  };

  return {
    id: generation.id,
    status: generation.status,
    aspectRatio: generation.aspectRatio,
    watermarked: generation.watermarked,
    source: generation.source,
    // Двойна проверка: полето и без това се пълни само при линк, но
    // правилото „магазин само при линк" се вижда и тук, на изхода.
    merchant: generation.source === 'LINK' ? generation.merchant : null,
    category: generation.category,
    errorCode: generation.errorCode,
    createdAt: generation.createdAt.toISOString(),
    elapsedSeconds: Math.max(
      0,
      Math.round((Date.now() - generation.createdAt.getTime()) / 1000),
    ),
    resultUrl,
    personUrl,
    saved: generation.savedAt !== null,
    published: generation.publishedAt !== null,
    // Предложенията се смятат само за готова визия — под чакащ екран няма
    // какво да се купува към нея.
    recommendations: generation.status === 'DONE' ? blocksFor(reco) : [],
    waiting: generation.status === 'DONE' ? [] : waitCards(reco),
  };
}

/** Приключила ли е генерацията — потокът със събития спира дотук. */
export function isTerminal(status: GenerationView['status']): boolean {
  return status === 'DONE' || status === 'FAILED' || status === 'REFUNDED';
}

/** Съобщения за човек по код на грешка. Никога не показваме суровия код. */
export const ERROR_MESSAGES: Record<string, string> = {
  TIMEOUT: 'Отне прекалено дълго. Кредитът ти е върнат — пробвай пак.',
  MODERATION: 'Тази снимка не мина проверката. Пробвай с друга.',
  PROVIDER_FAILED: 'Не се получи. Кредитът ти е върнат — пробвай с друга снимка.',
  PROVIDER_UNAVAILABLE: 'Услугата не отговаря в момента. Кредитът ти е върнат.',
  PROVIDER_RATE_LIMIT: 'Прекалено много заявки в момента. Кредитът ти е върнат.',
  PROVIDER_AUTH: 'Нещо при нас не е наред. Кредитът ти е върнат, вече го гледаме.',
  PROVIDER_BAD_REQUEST: 'Нещо в снимките не се хареса. Кредитът ти е върнат.',
  INTERNAL: 'Нещо се обърка при нас. Кредитът ти е върнат.',
};

export function messageForError(code: string | null): string | null {
  if (!code) return null;
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.INTERNAL ?? null;
}
