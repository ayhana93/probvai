'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Patch } from '@/components/ui/patch';
import { Sheet } from '@/components/ui/sheet';
import { Sparks, Zigzag } from '@/components/ui/scribble';
import { cn } from '@/lib/cn';

/**
 * ГАРДЕРОБ
 *
 * Две колони. Всички гардероби са частни — няма публичен режим и няма
 * чужди профили.
 *
 * ═══ ЗАЩО ИЗТРИВАНЕТО Е СКРИТО ЗАД ЗАДЪРЖАНЕ ═══
 *
 * Кошче в ъгъла на всяка снимка би било по-лесно за намиране — и точно
 * затова е по-лошо. Гардеробът се разглежда с палец, докато се скролва;
 * кошче под палеца се натиска по погрешка. Задържането не се случва
 * случайно.
 *
 * Затова обаче то трябва да е ОТКРИВАЕМО: снимката се свива, докато
 * пръстът стои отгоре, така че жестът се самообяснява още преди да е
 * завършил.
 */

type Item = {
  id: string;
  merchant: string | null;
  watermarked: boolean;
  url: string;
};

const ITEMS: Item[] = [
  { id: '1', merchant: 'Shein', watermarked: true, url: '/demo/sled.jpg' },
  { id: '2', merchant: 'Vinted', watermarked: true, url: '/demo/sled.jpg' },
  { id: '3', merchant: 'Zalando', watermarked: false, url: '/demo/sled.jpg' },
  { id: '4', merchant: null, watermarked: false, url: '/demo/sled.jpg' },
];

/** Колко трябва да се задържи, за да значи „изтрий". */
const HOLD_MS = 520;

function Tile({
  item,
  onOpen,
  onHold,
}: {
  item: Item;
  onOpen: () => void;
  onHold: () => void;
}) {
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = React.useState(false);
  const fired = React.useRef(false);

  const stop = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  }, []);

  React.useEffect(() => stop, [stop]);

  return (
    <button
      className="block w-full text-left"
      onPointerDown={() => {
        fired.current = false;
        setHolding(true);
        timer.current = setTimeout(() => {
          fired.current = true;
          setHolding(false);
          onHold();
        }, HOLD_MS);
      }}
      onPointerUp={() => {
        stop();
        // Задържането вече е свършило работа — натискането не бива да
        // отвори и снимката отгоре.
        if (!fired.current) onOpen();
      }}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(event) => event.preventDefault()}
    >
      <Patch
        material="paper"
        className={cn(
          'relative aspect-[3/4] overflow-hidden',
          'transition-transform duration-[var(--dur-menu)] ease-[var(--ease-out)]',
          holding && 'scale-[0.94]',
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt=""
          draggable={false}
          loading="lazy"
          className="size-full object-cover"
        />

        {item.merchant && (
          <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-1 text-[10.5px] font-semibold text-paper backdrop-blur-sm">
            {item.merchant}
          </span>
        )}

        {item.watermarked && (
          <span className="absolute bottom-2 right-2 rounded-full bg-violet px-2 py-1 text-[10.5px] font-semibold text-white">
            воден знак
          </span>
        )}
      </Patch>
    </button>
  );
}

export default function GarderobPage() {
  const [items, setItems] = React.useState(ITEMS);
  const [open, setOpen] = React.useState<Item | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<Item | null>(null);

  // Escape затваря целия екран.
  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (items.length === 0) {
    return (
      <main className="flex min-h-[70dvh] flex-col items-center justify-center px-8 text-center">
        {/* Празното състояние показва КАКВО идва: три празни парчета,
            подредени като бъдещия гардероб. По-разбираемо от една икона. */}
        <div aria-hidden="true" className="relative mb-7 flex items-end gap-2">
          <Patch material="paper" tilt={-6} className="h-20 w-16 opacity-45" />
          <Patch material="knit" tilt={2} className="h-28 w-20" />
          <Patch material="paper" tilt={6} className="h-20 w-16 opacity-45" />
          <Sparks className="absolute -right-5 -top-3 h-5 w-8 text-violet" />
        </div>

        <h1 className="display text-[24px]">Още е празно</h1>
        <p className="mt-2 max-w-[260px] text-[14px] leading-snug text-ink-45">
          Първата ти проба ще се появи тук. Гардеробът е само твой — никой друг
          не го вижда.
        </p>
        <Link
          href="/proba"
          className="pressable mt-6 inline-flex items-center rounded-full bg-lime px-7 py-3.5 shadow-[0_3px_0_var(--color-lime-deep)]"
        >
          <span className="display text-[16px]">Пробвай нещо</span>
        </Link>
      </main>
    );
  }

  return (
    <main className="px-5 pt-6">
      <div className="flex items-end justify-between">
        <h1 className="display text-[28px]">Гардероб</h1>
        <Zigzag className="mb-2 h-4 w-14 text-ink/20" />
      </div>
      <p className="mt-2 text-[14px] text-ink-45">
        {items.length} проби · само твои · задръж, за да изтриеш
      </p>

      <ul className="stagger mt-5 grid grid-cols-2 gap-3">
        {items.map((item) => (
          <li key={item.id}>
            <Tile
              item={item}
              onOpen={() => setOpen(item)}
              onHold={() => setPendingDelete(item)}
            />
          </li>
        ))}
      </ul>

      {/* ── Цял екран ──────────────────────────────────────────────────── */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Проба на цял екран"
          className="fixed inset-0 z-50 flex flex-col bg-ink/95 backdrop-blur-sm"
          onClick={() => setOpen(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={open.url}
            alt=""
            className="enter-pop m-auto max-h-[78dvh] max-w-full object-contain"
          />
          <div className="pb-[max(24px,env(safe-area-inset-bottom))] text-center">
            <button
              onClick={() => setOpen(null)}
              className="pressable rounded-full bg-paper/15 px-6 py-3 text-[14px] font-semibold text-paper"
            >
              Затвори
            </button>
          </div>
        </div>
      )}

      {/* ── Изтриване ──────────────────────────────────────────────────── */}
      <Sheet
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Изтриване"
      >
        <div className="pb-2">
          <p className="text-[14px] leading-snug text-ink-70">
            Пробата се изтрива завинаги. Кредитът, който е струвала, не се
            връща.
          </p>

          <Button
            variant="danger"
            size="lg"
            block
            className="mt-5"
            onClick={() => {
              setItems((current) => current.filter((entry) => entry.id !== pendingDelete?.id));
              setPendingDelete(null);
            }}
          >
            Изтрий
          </Button>
          <button
            onClick={() => setPendingDelete(null)}
            className="pressable mt-2 flex h-12 w-full items-center justify-center text-[14px] font-semibold text-ink-45"
          >
            Откажи
          </button>
        </div>
      </Sheet>
    </main>
  );
}
