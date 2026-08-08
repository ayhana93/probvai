import { dbSystem } from '@probvai/db';
import {
  env,
  storageConfigured,
  uploadUserImage,
  type ImageKind,
  type UploadFailure,
} from '@probvai/core';
import { jsonError, requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KINDS = new Set<ImageKind>(['person', 'garment']);

/**
 * Съобщенията се сглобяват при ЗАЯВКА, не при зареждане на модула.
 *
 * Като константа отгоре, шаблонният низ четеше `env.UPLOAD_MAX_BYTES` в
 * момента на внасяне на файла. А този файл се внася и от `next build`,
 * в стъпката „Collecting page data" — тоест билдът искаше настройка,
 * която е на средата, не на кода.
 *
 * Правилото: на ниво модул не се чете нищо от средата. Билдът произвежда
 * образ, който тръгва на всяка среда; стойностите идват при работа.
 */
function messages(): Record<UploadFailure, string> {
  const maxMb = Math.round(env.UPLOAD_MAX_BYTES / (1024 * 1024));

  return {
    EMPTY_FILE: 'Файлът е празен.',
    TOO_LARGE: `Снимката е над ${maxMb} MB. Избери по-малка.`,
    UNSUPPORTED_TYPE: 'Приемаме само JPG, PNG и WebP.',
    CORRUPT_IMAGE: 'Файлът не се отваря като снимка. Пробвай друг.',
  };
}

/**
 * POST /api/upload — качване на снимка на човек или на дреха.
 *
 * Проверката е по съдържание, не по име на файл: `.exe`, преименуван на
 * `.jpg`, се отказва. Метаданните, включително GPS координатите, се махат
 * при обработката.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await requireUser();
  if (session.response) return session.response;

  // Липсващото хранилище е наш пропуск, не негов. Казваме го така, вместо
  // да го оставим да гледа „Нещо се обърка" и да пробва пак и пак.
  if (!storageConfigured()) {
    return jsonError(
      503,
      'STORAGE_NOT_CONFIGURED',
      'Качването не работи в момента. Проблемът е при нас — пробвай пак по-късно.',
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'Заявката не е правилно оформена.');
  }

  const kindRaw = form.get('kind');
  const kind = typeof kindRaw === 'string' ? (kindRaw as ImageKind) : 'person';
  if (!KINDS.has(kind)) {
    return jsonError(400, 'BAD_KIND', 'Непознат вид снимка.');
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return jsonError(400, 'NO_FILE', 'Не намерих файл в заявката.');
  }

  // Груба проверка още преди да четем — не искаме 500 MB в паметта.
  if (file.size > env.UPLOAD_MAX_BYTES) {
    return jsonError(413, 'TOO_LARGE', messages().TOO_LARGE);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await uploadUserImage(session.user.id, bytes, kind);

  if (!result.ok) {
    const status = result.reason === 'TOO_LARGE' ? 413 : 415;
    return jsonError(status, result.reason, messages()[result.reason]);
  }

  // Снимката на човека може да стане „моята снимка" за следващия път.
  if (kind === 'person' && form.get('setAsDefault') === 'true') {
    await dbSystem().user.update({
      where: { id: session.user.id },
      data: { defaultPhotoKey: result.image.key },
    });
  }

  return Response.json({
    key: result.image.key,
    width: result.image.width,
    height: result.image.height,
    bytes: result.image.bytes,
  });
}
