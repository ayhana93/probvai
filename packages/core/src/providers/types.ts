/**
 * ДОСТАВЧИЦИ НА ВИРТУАЛНА ПРОБА — общият интерфейс.
 *
 * Бизнес логиката никога не вика доставчик директно. Само през този интерфейс.
 * Така смяната на доставчик е една променлива на средата, а не преписване.
 *
 * ФАЗА 0: само типовете. Реализациите идват във Фаза 2.
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
  /** Подписан адрес към снимката на човека. */
  personUrl: string;
  /** Подписан адрес към снимката на дрехата. */
  garmentUrl: string;
  /**
   * Съотношението на кадъра. Не влияе на себестойността — за разлика от
   * режима и резолюцията, които са заковани в самата реализация.
   */
  aspectRatio: AspectRatio;
};

export type PollResult = {
  status: 'pending' | 'done' | 'failed';
  /** При `done`: адрес или data URI към готовото изображение. */
  imageUrl?: string;
  /** При `failed`: код, който записваме в `generations.error_code`. */
  errorCode?: string;
};

export interface TryOnProvider {
  /** Записва се в `generations.provider`. */
  name: ProviderName;

  /**
   * Себестойност на една генерация в долари. Сумата за деня се сравнява с
   * MAX_DAILY_SPEND_USD. Стойността е закована заедно с режима и резолюцията —
   * промениш ли едното без другото, тавана лъже.
   */
  costUSD: number;

  run(input: RunInput): Promise<{ jobId: string }>;

  poll(jobId: string): Promise<PollResult>;
}
