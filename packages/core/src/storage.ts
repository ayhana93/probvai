/**
 * ФАЙЛОВЕ — S3-съвместим слой над Cloudflare R2.
 *
 * Нищо специфично за R2 не изтича навън. Ако утре сменим хранилището,
 * се пипа само този файл.
 *
 * ФАЗА 0: само интерфейсът. Реализацията идва във Фаза 1.
 */

/** Какъв е файлът. Влиза в ключа и определя правилата за живот. */
export type ImageKind = 'person' | 'garment' | 'result';

/** Форматите, които приемаме. Проверява се по magic bytes, не по разширение. */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export type StoredImage = {
  key: string;
  contentType: AllowedImageType;
  width: number;
  height: number;
  bytes: number;
};

export type UploadFailure =
  | 'TOO_LARGE'
  | 'UNSUPPORTED_TYPE'
  | 'CORRUPT_IMAGE'
  | 'EMPTY_FILE';

export type UploadResult =
  | { ok: true; image: StoredImage }
  | { ok: false; reason: UploadFailure };

const NOT_IMPLEMENTED = 'Реализацията идва във Фаза 1 — Автентикация и кредити';

/**
 * Схема на ключовете: `users/{userId}/{kind}/{uuid}.{ext}`
 *
 * Потребителят е част от пътя, за да може изтриването на профил да мине
 * с един префиксен списък, без да гадаем кой файл чий е.
 */
export function buildKey(userId: string, kind: ImageKind, ext: string): string {
  const uuid = crypto.randomUUID();
  const clean = ext.replace(/^\./, '').toLowerCase();
  return `users/${userId}/${kind}/${uuid}.${clean}`;
}

/**
 * Приема качен файл, проверява го и го качва в R2.
 *
 * Проверките, които НЕ се пропускат:
 *   • magic bytes, не разширението — файл `.exe`, преименуван на `.jpg`,
 *     трябва да бъде отказан
 *   • максимум UPLOAD_MAX_BYTES
 *   • само jpeg / png / webp
 *   • дългата страна се смалява до UPLOAD_MAX_DIMENSION
 */
export async function uploadUserImage(
  _userId: string,
  _file: Uint8Array,
  _kind: ImageKind,
): Promise<UploadResult> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Подписан адрес за четене. По подразбиране валиден SIGNED_URL_TTL_SECONDS. */
export async function getSignedUrl(_key: string, _ttl?: number): Promise<string> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Трие един обект. Ползва се при изтриване на профил и при чистенето на 90-ия ден. */
export async function deleteObject(_key: string): Promise<void> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Трие всичко под даден префикс — например всички файлове на един потребител. */
export async function deletePrefix(_prefix: string): Promise<number> {
  throw new Error(NOT_IMPLEMENTED);
}
