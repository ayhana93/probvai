/**
 * ФАЙЛОВЕ — S3-съвместим слой над Cloudflare R2.
 *
 * Нищо специфично за R2 не изтича навън. Ако утре сменим хранилището с MinIO
 * или S3, се пипа само този файл и `R2_ENDPOINT` в средата.
 *
 * Всички обекти са ЧАСТНИ. Достъпът минава през подписан адрес с кратък
 * живот — никога през публичен URL. Гардеробът е личен.
 */

import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl as presign } from '@aws-sdk/s3-request-presigner';
import { env, requireEnv } from './env';
import { prepareUserImage, type PrepareFailure } from './image';

/** Какъв е файлът. Влиза в ключа. */
export type ImageKind = 'person' | 'garment' | 'result' | 'avatar';

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export type StoredImage = {
  key: string;
  contentType: string;
  width: number;
  height: number;
  bytes: number;
};

export type UploadFailure = PrepareFailure;

export type UploadResult =
  | { ok: true; image: StoredImage }
  | { ok: false; reason: UploadFailure };

// ---------------------------------------------------------------------------
// Клиент
// ---------------------------------------------------------------------------

let client: S3Client | undefined;

function s3(): S3Client {
  if (client) return client;

  const accountId = requireEnv('R2_ACCOUNT_ID', 'достъп до хранилището');
  const accessKeyId = requireEnv('R2_ACCESS_KEY_ID', 'достъп до хранилището');
  const secretAccessKey = requireEnv('R2_SECRET_ACCESS_KEY', 'достъп до хранилището');

  client = new S3Client({
    // R2 не ползва региони, но SDK-то иска стойност.
    region: 'auto',
    endpoint: env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return client;
}

function bucket(): string {
  return requireEnv('R2_BUCKET', 'достъп до хранилището');
}

/**
 * Настроено ли е изобщо хранилището.
 *
 * ═══ ЗАЩО ГО ИМА ═══
 *
 * Без тези четири стойности `s3()` хвърля някъде дълбоко в качването и
 * човекът отсреща вижда „Нещо се обърка" — съобщение, което не помага нито
 * на него, нито на нас. С тази проверка отказът излиза ПРЕДИ да сме чели
 * файла и казва точно какво липсва: настройка на средата, не негова грешка.
 */
export function storageConfigured(): boolean {
  return Boolean(
    env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET &&
      (env.R2_ACCOUNT_ID || env.R2_ENDPOINT),
  );
}

// ---------------------------------------------------------------------------
// Ключове
// ---------------------------------------------------------------------------

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

/** Всички файлове на един потребител. Ползва се при изтриване на профил. */
export function userPrefix(userId: string): string {
  return `users/${userId}/`;
}

/** Проверява, че ключът принадлежи на този потребител. */
export function keyBelongsTo(key: string, userId: string): boolean {
  return key.startsWith(userPrefix(userId));
}

// ---------------------------------------------------------------------------
// Операции
// ---------------------------------------------------------------------------

/**
 * Приема качен файл, проверява го и го качва.
 *
 * Проверките са в `image.ts` и не се пропускат:
 *   • magic bytes, не разширението
 *   • максимум UPLOAD_MAX_BYTES
 *   • само jpeg / png / webp
 *   • дългата страна се смалява до UPLOAD_MAX_DIMENSION
 *   • метаданните, включително GPS, се махат
 */
export async function uploadUserImage(
  userId: string,
  file: Uint8Array,
  kind: ImageKind,
): Promise<UploadResult> {
  const prepared = await prepareUserImage(file);
  if (!prepared.ok) {
    return { ok: false, reason: prepared.reason };
  }

  const { image } = prepared;
  const key = buildKey(userId, kind, image.extension);

  await s3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: image.data,
      ContentType: image.contentType,
      // Обектът е частен. Няма ACL, няма публичен достъп.
      Metadata: { 'uploaded-by': userId },
    }),
  );

  return {
    ok: true,
    image: {
      key,
      contentType: image.contentType,
      width: image.width,
      height: image.height,
      bytes: image.bytes,
    },
  };
}

/**
 * Качва вече обработен байтов масив — резултат от генерация или снимка
 * с воден знак. Не минава през проверките за качен от потребител файл.
 */
export async function putObject(
  key: string,
  data: Uint8Array,
  contentType: string,
): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: data,
      ContentType: contentType,
    }),
  );
}

/** Подписан адрес за четене. По подразбиране валиден SIGNED_URL_TTL_SECONDS. */
export async function getSignedUrl(key: string, ttl?: number): Promise<string> {
  return presign(s3(), new GetObjectCommand({ Bucket: bucket(), Key: key }), {
    expiresIn: ttl ?? env.SIGNED_URL_TTL_SECONDS,
  });
}

/** Сваля обект в паметта. Ползва се от работника за водния знак. */
export async function getObject(key: string): Promise<Uint8Array> {
  const response = await s3().send(
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
  );
  if (!response.Body) {
    throw new Error(`Обектът ${key} е празен`);
  }
  return response.Body.transformToByteArray();
}

/** Трие един обект. */
export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

/**
 * Трие всичко под даден префикс и връща броя изтрити обекти.
 * Ползва се при изтриване на профил и при чистенето на 90-ия ден.
 */
export async function deletePrefix(prefix: string): Promise<number> {
  const name = bucket();
  let deleted = 0;
  let continuationToken: string | undefined;

  do {
    const listed = await s3().send(
      new ListObjectsV2Command({
        Bucket: name,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    const keys = (listed.Contents ?? [])
      .map((object) => object.Key)
      .filter((key): key is string => Boolean(key));

    if (keys.length > 0) {
      await s3().send(
        new DeleteObjectsCommand({
          Bucket: name,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      deleted += keys.length;
    }

    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);

  return deleted;
}

/** Само за тестове и за смяна на настройките по време на работа. */
export function resetStorageClient(): void {
  client = undefined;
}
