/**
 * ДОСТАВЧИЦИ НА ВИРТУАЛНА ПРОБА — общият интерфейс.
 *
 * Бизнес логиката никога не вика доставчик директно. Само през този интерфейс.
 * Така смяната на доставчик е една променлива на средата, а не преписване.
 */

/**
 * Съотношението на кадъра е ЕДИНСТВЕНАТА настройка, достъпна за
 * потребителката. Не влияе на цената.
 *
 * Сървърът валидира стойността срещу този списък. Всичко извън него → 400,
 * без да се харчи кредит.
 */
export const ALLOWED_ASPECT_RATIOS = ['auto', '3:4', '4:5', '9:16', '1:1'] as const;
export type AspectRatio = (typeof ALLOWED_ASPECT_RATIOS)[number];
export const DEFAULT_ASPECT_RATIO: AspectRatio = 'auto';

export function isAllowedAspectRatio(value: unknown): value is AspectRatio {
  return (
    typeof value === 'string' &&
    (ALLOWED_ASPECT_RATIOS as readonly string[]).includes(value)
  );
}

/** Имената на доставчиците, както се задават в TRYON_PROVIDER. */
export const PROVIDER_NAMES = [
  'fashn_tryon_max',
  'fashn_v16',
  'fal_image_apps_v2',
] as const;
export type ProviderName = (typeof PROVIDER_NAMES)[number];

export type RunInput = {
  /** Подписан адрес към снимката на човека. Валиден кратко време. */
  personUrl: string;
  /** Подписан адрес към снимката на дрехата. */
  garmentUrl: string;
  /**
   * Съотношението на кадъра. Не влияе на себестойността — за разлика от
   * режима и резолюцията, които са заковани в самата реализация.
   *
   * Не всички доставчици го поддържат. Тези, които не го поддържат,
   * го пренебрегват и връщат родното съотношение.
   */
  aspectRatio: AspectRatio;
};

/**
 * Кодове на грешки, които записваме в `generations.error_code`.
 * Държим ги кратки и стабилни — по тях се групират проблемите в админ панела.
 */
export type ProviderErrorCode =
  /** Ключът липсва или е невалиден. Не се повтаря — оправя се от човек. */
  | 'PROVIDER_AUTH'
  /** Доставчикът отказа заявката. Не се повтаря — нещо в подаденото не му харесва. */
  | 'PROVIDER_BAD_REQUEST'
  /** Достигнат лимит при доставчика. Може да се повтори по-късно. */
  | 'PROVIDER_RATE_LIMIT'
  /** Доставчикът е паднал или бави. Може да се повтори. */
  | 'PROVIDER_UNAVAILABLE'
  /** Генерацията се провали при доставчика. */
  | 'PROVIDER_FAILED'
  /** Не се събра в отреденото време. */
  | 'TIMEOUT'
  /** Модерацията при доставчика отказа снимката. */
  | 'MODERATION'
  /** Нещо неочаквано от наша страна. */
  | 'INTERNAL';

export type PollResult = {
  status: 'pending' | 'done' | 'failed';
  /**
   * При `done`: адрес към готовото изображение ИЛИ `data:` URI, когато
   * доставчикът връща base64.
   */
  imageUrl?: string;
  /** При `failed`: код за `generations.error_code`. */
  errorCode?: ProviderErrorCode;
  /** Свободен текст за лога. Никога не се показва на потребителката. */
  detail?: string;
};

/** Грешка, за която няма смисъл да опитваме пак. */
export class ProviderError extends Error {
  constructor(
    readonly code: ProviderErrorCode,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface TryOnProvider {
  /** Записва се в `generations.provider`. */
  name: ProviderName;

  /**
   * Себестойност на една генерация в долари. Сумата за деня се сравнява с
   * MAX_DAILY_SPEND_USD. Стойността е закована заедно с режима и резолюцията —
   * промениш ли едното без другото, таванът лъже.
   */
  costUSD: number;

  /** Поддържа ли избор на съотношение. */
  supportsAspectRatio: boolean;

  run(input: RunInput): Promise<{ jobId: string }>;

  poll(jobId: string): Promise<PollResult>;
}
