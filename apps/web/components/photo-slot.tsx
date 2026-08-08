/**
 * МЯСТОТО ЗА СНИМКА
 *
 * Едно каре с плюс. Натиска се, отваря се галерията на телефона, избраната
 * снимка се вижда веднага и тръгва към сървъра сама.
 *
 * ═══ ЗАЩО КАЧВАНЕТО ТРЪГВА БЕЗ ВТОРО НАТИСКАНЕ ═══
 *
 * Отделно копче „Качи" е още едно действие след действието, което човек
 * вече е направил — избрал е снимка, значи иска тази снимка. Второто
 * копче само дава повод да се забрави и после да не разбереш защо
 * „Генерирай" стои сиво.
 *
 * ═══ ЗАЩО ПРЕГЛЕДЪТ Е ЛОКАЛЕН ═══
 *
 * Показва се файлът от телефона, не свален от сървъра. Така снимката се
 * вижда в същия миг, дори мрежата да е слаба, а грешният файл се хваща
 * преди да е качен.
 *
 * ═══ КАКВО ОЗНАЧАВА „ГОТОВО" ═══
 *
 * Кантът става лаймов ЕДВА когато сървърът е върнал ключ. Докато качването
 * върви, се вижда преглед и надпис „Качваме…", но карето не е зелено —
 * иначе зеленото щеше да значи „избрано", а нататък по потока трябва да
 * значи „наистина е горе".
 */

'use client';

import * as React from 'react';
import { Patch, type Material } from '@/components/ui/patch';
import { PlusIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

type Props = {
  /** Какво се качва. Влиза в заявката и определя папката в хранилището. */
  kind: 'person' | 'garment';
  /** Да стане ли „моята снимка" за следващите проби. Само за човек. */
  setAsDefault?: boolean;
  /** Вече качен ключ — при връщане на екрана или дреха, взета от Lookbook. */
  value: string | null;
  onChange: (key: string | null) => void;
  /** Показва се, докато няма избрана снимка. */
  hint: string;
  /** Ако вече има запазена снимка на сървъра, оттук се показва. */
  fallbackSrc?: string;
  material?: Material;
  className?: string;
};

export function PhotoSlot({
  kind,
  setAsDefault = false,
  value,
  onChange,
  hint,
  fallbackSrc,
  material = 'paper',
  className,
}: Props) {
  const input = React.useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Адресът от `createObjectURL` държи файла в паметта, докато не се
  // освободи. Без това всяка смяна изтича по няколко мегабайта.
  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function choose(file: File | undefined): Promise<void> {
    if (!file || busy) return;

    setError(null);
    onChange(null);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });

    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', kind);
      if (setAsDefault) form.append('setAsDefault', 'true');

      const response = await fetch('/api/upload', { method: 'POST', body: form });
      const data = (await response.json()) as
        | { key: string }
        | { error: { message: string } };

      if (!response.ok || !('key' in data)) {
        setError('error' in data ? data.error.message : 'Не се качи. Пробвай пак.');
        return;
      }

      onChange(data.key);
    } catch {
      setError('Няма връзка. Провери интернета и пробвай пак.');
    } finally {
      setBusy(false);
    }
  }

  // Показва се локалният файл, ако има такъв; иначе запазеното на сървъра.
  // Ключ без локален преглед идва отвън — например дреха, взета от Lookbook.
  const image =
    preview ?? (value ? `/api/images/${value}` : null) ?? fallbackSrc ?? null;

  // „Потвърдена" е снимка, за която сървърът е казал „приех я": или току-що
  // е върнал ключ, или вече я е имал отпреди (`fallbackSrc`). Локалният
  // преглед сам по себе си не значи нищо — той е файл в телефона.
  const confirmed = !busy && (Boolean(value) || (preview === null && Boolean(fallbackSrc)));

  return (
    <div className={className}>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          void choose(event.target.files?.[0]);
          // Без това повторният избор на СЪЩИЯ файл не вдига `change`.
          event.target.value = '';
        }}
      />

      <button
        type="button"
        onClick={() => input.current?.click()}
        aria-label={image ? 'Смени снимката' : hint}
        className="pressable block w-full text-left"
      >
        <Patch
          material={material}
          tilt={-1.5}
          className={cn(
            'grid size-full place-items-center overflow-hidden p-2',
            // Пунктирът е покана да се натисне. Щом има снимка, вече не е
            // покана — става плътен кант и престава да мига пред очите.
            'transition-[opacity] duration-[var(--dur-menu)] ease-[var(--ease-out)]',
          )}
        >
          <div
            className={cn(
              'relative grid size-full place-items-center overflow-hidden rounded-[12px_9px_14px_8px]',
              image
                ? confirmed
                  ? 'ring-[3px] ring-lime-deep'
                  : 'ring-[3px] ring-ink-25'
                : 'border-2 border-dashed border-ink-25 bg-paper-3',
            )}
          >
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className="size-full object-cover" draggable={false} />
            ) : (
              <span className="grid place-items-center gap-1 px-2 text-center text-ink-45">
                <PlusIcon />
                <span className="text-[12px] leading-tight">{hint}</span>
              </span>
            )}

            {busy && (
              <span className="absolute inset-0 grid place-items-center bg-paper/70 text-[12px] font-semibold text-ink-70">
                Качваме...
              </span>
            )}
          </div>
        </Patch>
      </button>

      {error && (
        <p className="enter-rise mt-1.5 text-[12px] leading-snug text-danger">{error}</p>
      )}
    </div>
  );
}
