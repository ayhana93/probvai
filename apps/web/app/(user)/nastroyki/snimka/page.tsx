'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Patch } from '@/components/ui/patch';
import { CheckIcon, CrossIcon } from '@/components/ui/icons';
import { useMe } from '@/lib/use-me';
import { R } from '@/lib/routes';
import { cn } from '@/lib/cn';

/**
 * СНИМКАТА ПО ПОДРАЗБИРАНЕ
 *
 * Този екран го нямаше — връзката от настройките водеше в 404. Сега е тук
 * и е първото място в приложението, което наистина ползва `/api/upload`.
 *
 * ═══ ЗАЩО СЕ КАЧВА ЕДНА СНИМКА, А НЕ АЛБУМ ═══
 *
 * Една снимка, която стои и се ползва за всяка проба. Албум значи избор
 * при всяка генерация — още едно решение точно преди действието, което
 * човекът е дошъл да направи.
 *
 * ═══ ПРЕГЛЕД ПРЕДИ КАЧВАНЕ ═══
 *
 * Избраната снимка се показва ЛОКАЛНО, преди да тръгне към сървъра. Така
 * грешният файл се хваща веднага, а не след като е качен и е станал
 * „твоята снимка".
 */

const GOOD = [
  'Цял ръст или поне до коленете',
  'Лицето се вижда ясно',
  'Дневна светлина, без силни сенки',
  'Права стойка, ръцете свободно',
];

const BAD = 'Не отдалеч · не в тъмно · не с очила · не в движение';

export default function SnimkaPage() {
  const { me, reload } = useMe();

  const input = React.useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  // Адресът от `createObjectURL` държи файла в паметта, докато не се
  // освободи. Без това всяка смяна на снимка изтича по няколко мегабайта.
  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function choose(selected: File | undefined): void {
    if (!selected) return;
    setError(null);
    setSaved(false);
    setFile(selected);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(selected);
    });
  }

  async function upload(): Promise<void> {
    if (!file || busy) return;
    setBusy(true);
    setError(null);

    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', 'person');
      // Заради това полето `default_photo_key` се записва в същата заявка.
      form.append('setAsDefault', 'true');

      const response = await fetch('/api/upload', { method: 'POST', body: form });
      // ⚠ `/api/upload` връща ключа НАПРАВО (`{ key, width, height, bytes }`),
      // не в обвивка `image`. Тук се четеше `data.image.key` и заради това
      // всяко успешно качване се показваше като „Не се качи."
      const data = (await response.json()) as
        | { key: string }
        | { error: { message: string } };

      if (!response.ok || !('key' in data)) {
        setError('error' in data ? data.error.message : 'Не се качи. Пробвай пак.');
        setBusy(false);
        return;
      }

      setSaved(true);
      await reload();
    } catch {
      setError('Няма връзка. Провери интернета и пробвай пак.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="px-5 pt-6">
      <Link
        href={R.settings}
        className="pressable -ml-1 flex size-10 items-center justify-center rounded-full text-ink-45"
        aria-label="Назад"
      >
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </Link>

      <h1 className="display mt-3 text-[26px]">Твоята снимка</h1>
      <p className="mt-1.5 text-[14px] leading-snug text-ink-45">
        Използва се за всяка проба. Смени я, когато поискаш.
      </p>

      {/* ── Снимката ─────────────────────────────────────────────────────
          Съотношението е закачено, за да не подскача екранът, докато
          снимката се зарежда. */}
      <div className="mt-6 flex justify-center">
        <Patch material="paper" tilt={-1.5} className="w-[220px] overflow-hidden p-2.5">
          <div className="relative aspect-[3/4] overflow-hidden rounded-[12px_9px_14px_8px] ring-[3px] ring-ink">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Избраната снимка" className="size-full object-cover" />
            ) : me?.hasDefaultPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/api/me/snimka"
                alt="Снимката ти по подразбиране"
                className="size-full object-cover"
              />
            ) : (
              <div className="grid size-full place-items-center bg-paper-3 px-4 text-center">
                <span className="text-[13px] leading-snug text-ink-45">
                  Още няма снимка
                </span>
              </div>
            )}
          </div>
        </Patch>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => choose(event.target.files?.[0])}
      />

      <div className="mt-5 space-y-2.5">
        <Button
          variant={file ? 'quiet' : 'action'}
          size="lg"
          block
          onClick={() => input.current?.click()}
        >
          {me?.hasDefaultPhoto || preview ? 'Избери друга снимка' : 'Избери снимка'}
        </Button>

        {file && (
          <Button variant="action" size="lg" block busy={busy} onClick={() => void upload()}>
            {busy ? 'Качваме...' : 'Запази тази снимка'}
          </Button>
        )}
      </div>

      {error && (
        <p className="enter-rise mt-3 text-center text-[13px] text-danger">{error}</p>
      )}
      {saved && !error && (
        <p className="enter-rise mt-3 text-center text-[13px] text-ink-45">
          Готово. Оттук нататък пробите тръгват с нея.
        </p>
      )}

      {/* ── Какво прави снимката добра ────────────────────────────────── */}
      <section className="mt-9">
        <h2 className="display text-[17px] text-ink-45">За по-добър резултат</h2>
        <ul className="mt-3 space-y-1.5">
          {GOOD.map((line) => (
            <li key={line} className="flex gap-2 text-[13.5px] leading-tight text-ink-70">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-lime text-ink">
                <CheckIcon />
              </span>
              {line}
            </li>
          ))}
          <li className="flex gap-2 text-[13.5px] leading-tight text-ink-45">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ink text-paper">
              <CrossIcon />
            </span>
            {BAD}
          </li>
        </ul>
      </section>

      <p className={cn('mt-8 text-[12.5px] leading-snug text-ink-25')}>
        Снимката е само твоя. Не се показва на никого и не влиза в Lookbook —
        там отиват само готови визии, и то с изрично натискане.
      </p>
    </main>
  );
}
