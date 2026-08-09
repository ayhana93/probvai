'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Patch } from '@/components/ui/patch';
import { useMe } from '@/lib/use-me';
import { compressImage } from '@/lib/compress-image';
import { R } from '@/lib/routes';

/**
 * ПРОФИЛНАТА СНИМКА
 *
 * ═══ ТОВА НЕ Е СНИМКАТА ЗА ПРОБА ═══
 *
 * Двете бяха една и съща и екранът съветваше „цял ръст, добра светлина,
 * права стойка". За профилна снимка това е безсмислица: там човек слага
 * лицето си и толкова.
 *
 * Сега са отделни колони в базата. Тази снимка стои в кръгчето до името и
 * се сменя веднъж на няколко месеца; онази тръгва с всяка проба и се сменя
 * при всяко качване в стъпка 1. Общата колона значеше, че селфи в кръгчето
 * мълчаливо става снимката, върху която пробваме дрехи.
 *
 * ═══ КАЧВА СЕ ВЕДНАГА ═══
 *
 * Няма второ копче „Запази". Избрал си снимка — значи искаш тази снимка.
 */

export default function SnimkaPage() {
  const { me, reload } = useMe();

  const input = React.useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

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
    setSaved(false);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });

    setBusy(true);
    try {
      // Смалява се на телефона, преди да тръгне. Снимка от съвременен
      // телефон е 4–8 MB — по мобилна мрежа това е чакане без причина.
      const small = await compressImage(file);

      const form = new FormData();
      form.append('file', small);
      form.append('kind', 'avatar');

      const response = await fetch('/api/upload', { method: 'POST', body: form });
      const data = (await response.json()) as
        | { key: string }
        | { error: { message: string } };

      if (!response.ok || !('key' in data)) {
        setError('error' in data ? data.error.message : 'Не се качи. Пробвай пак.');
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

  const shown = preview ?? (me?.hasAvatar ? '/api/me/avatar' : null);

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

      <h1 className="display mt-3 text-[26px]">Профилна снимка</h1>
      <p className="mt-1.5 text-[14px] leading-snug text-ink-45">
        Вижда се само от теб, до името ти.
      </p>

      {/* ── Снимката ─────────────────────────────────────────────────────
          Кръгла, защото точно така се показва после. Квадратен преглед на
          кръгла снимка изненадва — човек нагласява кадър, който после се
          реже другояче. */}
      <div className="mt-8 flex justify-center">
        <Patch material="paper" tilt={-1.5} className="rounded-full p-2.5">
          <div className="relative size-[168px] overflow-hidden rounded-full ring-[3px] ring-ink">
            {shown ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shown} alt="Профилната ти снимка" className="size-full object-cover" />
            ) : (
              <div className="grid size-full place-items-center bg-paper-3 px-4 text-center">
                <span className="text-[13px] leading-snug text-ink-45">Още няма</span>
              </div>
            )}

            {busy && (
              <span className="absolute inset-0 grid place-items-center bg-paper/70 text-[13px] font-semibold text-ink-70">
                Качваме...
              </span>
            )}
          </div>
        </Patch>
      </div>

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

      <div className="mt-7">
        <Button
          variant="action"
          size="lg"
          block
          busy={busy}
          onClick={() => input.current?.click()}
        >
          {shown ? 'Избери друга снимка' : 'Избери снимка'}
        </Button>
      </div>

      {error && <p className="enter-rise mt-3 text-center text-[13px] text-danger">{error}</p>}
      {saved && !error && (
        <p className="enter-rise mt-3 text-center text-[13px] text-ink-45">Готово.</p>
      )}

      <p className="mt-8 text-[12.5px] leading-snug text-ink-25">
        Снимката е само твоя. Не се показва на никого и не влиза в Lookbook —
        там отиват само готови визии, и то с изрично натискане.
      </p>

      <p className="mt-3 text-[12.5px] leading-snug text-ink-25">
        Снимката, с която тръгва пробата, е друга — избира се в стъпка 1 на
        всяка нова проба.
      </p>
    </main>
  );
}
