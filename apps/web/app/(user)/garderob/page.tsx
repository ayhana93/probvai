'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Patch } from '@/components/ui/patch';
import { Sheet } from '@/components/ui/sheet';
import { Sparks, Zigzag } from '@/components/ui/scribble';
import { STYLE_KEYS, STYLE_LABELS, isStyleKey, type StyleKey } from '@/lib/styles';
import { cn } from '@/lib/cn';

/**
 * ГАРДЕРОБ
 *
 * Две колони, подредени по категории. Всяка готова проба влиза тук сама —
 * гардероб, от който нещо може да липсва, не е гардероб.
 *
 * ═══ ИМЕТО НА МАГАЗИНА ═══
 *
 * Стои върху плочката САМО когато пробата е направена от линк. При качена
 * снимка нямаме откъде да знаем от кой магазин е дрехата, а измислено име
 * е по-лошо от липсващо.
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
  url: string;
  merchant: string | null;
  category: string | null;
  watermarked: boolean;
  saved: boolean;
  published: boolean;
};

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

  const style = isStyleKey(item.category) ? STYLE_LABELS[item.category] : null;

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

        {/* Магазинът бие категорията за мястото горе вляво: той е по-рядък
            и носи повече информация. */}
        {item.merchant ? (
          <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-1 text-[10.5px] font-semibold text-paper backdrop-blur-sm">
            {item.merchant}
          </span>
        ) : style ? (
          <span className="absolute left-2 top-2 rounded-full bg-ink/70 px-2 py-1 text-[10.5px] font-semibold text-paper backdrop-blur-sm">
            {style.emoji} {style.label}
          </span>
        ) : null}

        {item.published && (
          <span
            title="В Lookbook"
            className="absolute right-2 top-2 rounded-full bg-lime px-1.5 py-1 text-[10.5px] font-semibold text-ink"
          >
            ✨
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
  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [category, setCategory] = React.useState<StyleKey | null>(null);
  const [open, setOpen] = React.useState<Item | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<Item | null>(null);
  const [pendingCategory, setPendingCategory] = React.useState<Item | null>(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);

    const params = category ? `?category=${category}` : '';
    void fetch(`/api/wardrobe${params}`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : { items: [] }))
      .then((data: { items: Item[] }) => {
        if (alive) setItems(data.items);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [category]);

  // Escape затваря целия екран.
  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  async function changeCategory(item: Item, next: StyleKey): Promise<void> {
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, category: next } : entry,
      ),
    );
    setPendingCategory(null);

    try {
      await fetch(`/api/generate/${item.id}/category`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ category: next }),
      });
    } catch {
      // Мрежата ще се оправи. Показаното остава показано.
    }
  }

  async function remove(item: Item): Promise<void> {
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    setPendingDelete(null);
    try {
      await fetch(`/api/generate/${item.id}`, { method: 'DELETE' });
    } catch {
      // Изтриването ще се повтори при следващо влизане.
    }
  }

  const empty = !loading && items.length === 0 && category === null;

  if (empty) {
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
          Първата ти проба ще се появи тук. Гардеробът е само твой, докато
          не решиш друго.
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
        {items.length} {items.length === 1 ? 'проба' : 'проби'} · задръж, за да
        изтриеш
      </p>

      {/* ── Категориите ───────────────────────────────────────────────────
          Пробите се подреждат сами. Тези копчета само филтрират. */}
      <div className="-mx-5 mt-4 overflow-x-auto px-5 pb-1">
        <div className="flex gap-2">
          <button
            onClick={() => setCategory(null)}
            aria-pressed={category === null}
            className={cn(
              'pressable shrink-0 rounded-full px-3.5 py-2 text-[12.5px] font-semibold',
              category === null ? 'bg-ink text-paper' : 'bg-paper-2 text-ink-70',
            )}
          >
            Всички
          </button>
          {STYLE_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => setCategory(category === key ? null : key)}
              aria-pressed={category === key}
              className={cn(
                'pressable shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[12.5px] font-semibold',
                category === key ? 'bg-ink text-paper' : 'bg-paper-2 text-ink-70',
              )}
            >
              {STYLE_LABELS[key].emoji} {STYLE_LABELS[key].label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="skeleton aspect-[3/4] rounded-[var(--radius-card)]" />
          <div className="skeleton aspect-[3/4] rounded-[var(--radius-card)]" />
        </div>
      ) : items.length === 0 ? (
        <p className="mt-8 text-center text-[14px] text-ink-45">
          Няма проби в тази категория.
        </p>
      ) : (
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
      )}

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
            className="enter-pop m-auto max-h-[70dvh] max-w-full object-contain"
          />
          <div className="flex justify-center gap-2 pb-[max(24px,env(safe-area-inset-bottom))]">
            <button
              onClick={(event) => {
                event.stopPropagation();
                setPendingCategory(open);
                setOpen(null);
              }}
              className="pressable rounded-full bg-paper/15 px-5 py-3 text-[14px] font-semibold text-paper"
            >
              Смени категорията
            </button>
            <button
              onClick={() => setOpen(null)}
              className="pressable rounded-full bg-paper/15 px-6 py-3 text-[14px] font-semibold text-paper"
            >
              Затвори
            </button>
          </div>
        </div>
      )}

      {/* ── Смяна на категорията ────────────────────────────────────────
          Категорията се слага сама след всяка проба. Тук се поправя — и с
          това се заключва: следващата обработка няма да я върне обратно. */}
      <Sheet
        open={pendingCategory !== null}
        onClose={() => setPendingCategory(null)}
        title="Категория"
      >
        <ul className="pb-2">
          {STYLE_KEYS.map((key) => (
            <li key={key}>
              <button
                onClick={() => {
                  if (pendingCategory) void changeCategory(pendingCategory, key);
                }}
                className="pressable flex h-13 w-full items-center gap-2.5 rounded-2xl px-1 py-3 text-left"
              >
                <span aria-hidden="true" className="text-[16px]">
                  {STYLE_LABELS[key].emoji}
                </span>
                <span className="text-[15px] font-medium">{STYLE_LABELS[key].label}</span>
                {pendingCategory?.category === key && (
                  <span className="ml-auto text-[15px] text-violet">✓</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

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
              if (pendingDelete) void remove(pendingDelete);
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
