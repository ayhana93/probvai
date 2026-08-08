/**
 * СМАЛЯВАНЕ НА СНИМКАТА В БРАУЗЪРА, ПРЕДИ ДА ТРЪГНЕ
 *
 * ═══ ЗАЩО НА ТЕЛЕФОНА, А НЕ САМО НА СЪРВЪРА ═══
 *
 * Сървърът така или иначе смалява всичко (`packages/core/src/image.ts`) —
 * тоест в хранилището влиза еднакво голям файл и без това. Пестенето тук е
 * друго и е по-важното: снимка от съвременен телефон е 4–8 MB, а по мобилна
 * мрежа това е 10–20 секунди качване, през които екранът стои на „Качваме…".
 *
 * Смалена преди тръгване, същата снимка е 300–600 KB. Разликата се вижда
 * веднага, а качеството — не: дългата страна остава 1600 пиксела, а моделът
 * за пробата работи с по-малко.
 *
 * ═══ ЗАЩО НЕ ГЪРМИ, КОГАТО НЕ УСПЕЕ ═══
 *
 * Огромен файл, странен формат, изчерпана памет — всичко това е възможно.
 * Тогава се връща ОРИГИНАЛЪТ и качването продължава както преди. Смаляването
 * е ускорение, не условие; провалът му не бива да отнема на човека
 * възможността да качи снимка.
 *
 * ═══ ЗАЩО СЕ ПАЗИ HEIC/HEIF НАСТРАНА ═══
 *
 * iPhone пази снимките в HEIC. Браузърът на телефона го отваря, но при
 * споделяне обикновено дава JPEG. Ако все пак дойде HEIC, който `createImageBitmap`
 * не може да отвори, пак се връща оригиналът и сървърът си казва думата.
 */

/** Дългата страна след смаляването. */
const MAX_EDGE = 1600;

/** Качество на JPEG. Над 0.85 файлът расте, без да се вижда разлика. */
const QUALITY = 0.82;

/** Под този размер не си струва — файлът вече е малък. */
const SKIP_UNDER_BYTES = 400 * 1024;

export async function compressImage(file: File): Promise<File> {
  if (typeof createImageBitmap !== 'function') return file;
  if (file.size <= SKIP_UNDER_BYTES) return file;

  try {
    const bitmap = await createImageBitmap(file);

    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return file;
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', QUALITY);
    });

    if (!blob) return file;

    // Ако „смаленото" излезе по-голямо — а при малка снимка с плътен цвят
    // това се случва — оригиналът си остава по-добрият избор.
    if (blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}
