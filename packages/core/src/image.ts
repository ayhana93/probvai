/**
 * ПРОВЕРКА И ПОДГОТОВКА НА ИЗОБРАЖЕНИЯ
 *
 * Отделено от `storage.ts` нарочно: тук няма мрежа и няма ключове, значи
 * може да се тества докрай. Точката от контролния списък „файл `.exe`,
 * преименуван на `.jpg` → отказ" се проверява точно тук.
 *
 * Две нива на проверка:
 *   1. magic bytes — първите байтове на файла, а не разширението.
 *      Разширението е текст, който всеки може да напише.
 *   2. истинско декодиране със sharp — файл с правилни първи байтове и
 *      боклук след тях не е изображение.
 */

import sharp from 'sharp';
import { env } from './env';

export type ImageFormat = 'jpeg' | 'png' | 'webp';

export const MIME_BY_FORMAT: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const EXT_BY_FORMAT: Record<ImageFormat, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
};

const SIGNATURES: { format: ImageFormat; test: (b: Uint8Array) => boolean }[] = [
  {
    format: 'jpeg',
    // FF D8 FF
    test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    format: 'png',
    // 89 50 4E 47 0D 0A 1A 0A
    test: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    format: 'webp',
    // "RIFF" .... "WEBP"
    test: (b) =>
      b.length >= 12 &&
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
];

/**
 * Разпознава формата по първите байтове.
 * Връща `null` за всичко останало — включително за `.exe`, преименуван на `.jpg`.
 */
export function sniffImageFormat(bytes: Uint8Array): ImageFormat | null {
  for (const { format, test } of SIGNATURES) {
    if (test(bytes)) return format;
  }
  return null;
}

export type PrepareFailure =
  | 'EMPTY_FILE'
  | 'TOO_LARGE'
  | 'UNSUPPORTED_TYPE'
  | 'CORRUPT_IMAGE';

export type PreparedImage = {
  data: Buffer;
  format: ImageFormat;
  contentType: string;
  extension: string;
  width: number;
  height: number;
  bytes: number;
};

export type PrepareResult =
  | { ok: true; image: PreparedImage }
  | { ok: false; reason: PrepareFailure };

export type PrepareOptions = {
  maxBytes?: number;
  maxDimension?: number;
};

/**
 * Проверява файла и го привежда в готов за качване вид.
 *
 * Какво прави със снимката:
 *   • завърта я по EXIF ориентацията — иначе снимките от телефон излизат легнали
 *   • смалява дългата страна до `maxDimension`, без да уголемява малките
 *   • МАХА ВСИЧКИ МЕТАДАННИ, включително GPS координатите от телефона
 *
 * Последното не е дребна подробност: качвайки снимка от вкъщи,
 * потребителя не бива да качва и адреса си.
 */
export async function prepareUserImage(
  input: Uint8Array,
  options: PrepareOptions = {},
): Promise<PrepareResult> {
  const maxBytes = options.maxBytes ?? env.UPLOAD_MAX_BYTES;
  const maxDimension = options.maxDimension ?? env.UPLOAD_MAX_DIMENSION;

  if (input.length === 0) {
    return { ok: false, reason: 'EMPTY_FILE' };
  }
  if (input.length > maxBytes) {
    return { ok: false, reason: 'TOO_LARGE' };
  }

  const format = sniffImageFormat(input);
  if (!format) {
    return { ok: false, reason: 'UNSUPPORTED_TYPE' };
  }

  try {
    const pipeline = sharp(Buffer.from(input), { failOn: 'error' })
      .rotate()
      .resize({
        width: maxDimension,
        height: maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      });

    // Запазваме формата, с който е дошла снимката — ключът в R2 носи
    // разширението и не искаме то да лъже.
    const encoded =
      format === 'jpeg'
        ? pipeline.jpeg({ quality: 90, mozjpeg: true })
        : format === 'png'
          ? pipeline.png({ compressionLevel: 9 })
          : pipeline.webp({ quality: 90 });

    const { data, info } = await encoded.toBuffer({ resolveWithObject: true });

    return {
      ok: true,
      image: {
        data,
        format,
        contentType: MIME_BY_FORMAT[format],
        extension: EXT_BY_FORMAT[format],
        width: info.width,
        height: info.height,
        bytes: data.length,
      },
    };
  } catch {
    // Правилни първи байтове, но невалидно съдържание.
    return { ok: false, reason: 'CORRUPT_IMAGE' };
  }
}
