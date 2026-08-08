/**
 * LOOKBOOK
 *
 * ═══ КАКВО НЕ Е ═══
 *
 * Няма профили. Няма последователи. Няма чат. Няма коментари. Под всяка
 * визия има точно ДВЕ неща:
 *
 *   Харесване — тихо, вляво. Задържа в галерията.
 *   Remix     — лаймово, вдясно. Взима дрехата от тази визия и я слага
 *               направо в стъпка 2 на нова проба.
 *
 * Второто е единственото, което води някъде, и затова изглежда като копче.
 *
 * „Запази" беше трето и отпадна: три действия под всяка снимка, при две
 * колонки на телефон, правят шест мънички цели за палец на един екран — и
 * нито едно от тях не е ясно кое е главното.
 *
 * ═══ ЗАЩО НЯМА ИМЕНА ПОД СНИМКИТЕ ═══
 *
 * Щом има име, има профил. Щом има профил, има последователи, после
 * съобщения, после модерация. Галерията показва ВИЗИИ, не хора — и точно
 * затова остава лека.
 *
 * ═══ БЕЗКРАЙНОТО СКРОЛВАНЕ ═══
 *
 * Следващата страница се иска, когато пазачът в дъното влезе в екрана —
 * `IntersectionObserver`, не слушане на `scroll`. Второто вика функция на
 * всеки кадър при влачене и изяжда батерията.
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Patch } from '@/components/ui/patch';
import { HeartIcon, RemixIcon } from '@/components/ui/icons';
import { STYLE_KEYS, STYLE_LABELS, isStyleKey, type StyleKey } from '@/lib/styles';
import { cn } from '@/lib/cn';
import { R } from '@/lib/routes';

type Look = {
  id: string;
  category: string | null;
  likeCount: number;
  liked: boolean;
  mine: boolean;
};

type Page = { seed: string; nextCursor: string | null; items: Look[] };

export function Lookbook() {
  const router = useRouter();
  const [looks, setLooks] = React.useState<Look[]>([]);
  const [seed, setSeed] = React.useState<string | null>(null);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState<StyleKey | null>(null);
  const [end, setEnd] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  const sentinel = React.useRef<HTMLDivElement | null>(null);
  // Пази от две едновременни искания за една и съща страница.
  const busy = React.useRef(false);

  const load = React.useCallback(
    async (options: { fresh?: boolean } = {}) => {
      if (busy.current) return;
      busy.current = true;
      setLoading(true);

      const params = new URLSearchParams();
      // Ново семе при смяна на категория — иначе новата подредба продължава
      // от курсор, който е от старата.
      if (!options.fresh && seed) params.set('seed', seed);
      if (!options.fresh && cursor) params.set('cursor', cursor);
      if (category) params.set('category', category);

      try {
        const response = await fetch(`/api/lookbook?${params}`, { cache: 'no-store' });
        if (response.ok) {
          const page = (await response.json()) as Page;
          setSeed(page.seed);
          setCursor(page.nextCursor);
          setEnd(page.nextCursor === null);
          setLooks((current) =>
            options.fresh ? page.items : [...current, ...page.items],
          );
        }
      } catch {
        // Без мрежа спираме тихо. Показаното остава показано.
      } finally {
        setLoading(false);
        busy.current = false;
      }
    },
    [seed, cursor, category],
  );

  // Първо зареждане и презареждане при смяна на категория.
  React.useEffect(() => {
    setLooks([]);
    setCursor(null);
    setSeed(null);
    setEnd(false);
    void load({ fresh: true });
    // `load` се променя с всяко състояние; тук нарочно следим само филтъра.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  // Безкрайното скролване.
  React.useEffect(() => {
    const node = sentinel.current;
    if (!node || end) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void load();
      },
      // Зарежда 400 пиксела преди дъното — така никога не се вижда празно.
      { rootMargin: '400px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [end, load]);

  async function toggleLike(look: Look): Promise<void> {
    // Показваме промяната веднага и я връщаме назад при отказ. Копче, което
    // чака мрежата, се натиска два пъти.
    setLooks((current) =>
      current.map((item) =>
        item.id !== look.id
          ? item
          : {
              ...item,
              liked: !item.liked,
              likeCount: item.likeCount + (item.liked ? -1 : 1),
            },
      ),
    );

    try {
      const response = await fetch(`/api/lookbook/${look.id}/like`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('отказано');
    } catch {
      setLooks((current) =>
        current.map((item) => (item.id === look.id ? look : item)),
      );
    }
  }

  return (
    <section className="mt-9">
      {/* ═══ ЗАЩО ПОДЗАГЛАВИЕТО МОЖЕ ДА ИЗЧЕЗНЕ ═══

          При включено увеличение в Safari екранът е широк 314 пиксела вместо
          393. Тогава двете надписа се събираха едно върху друго — заглавието
          е с тежък шрифт и не се свива, а подзаглавието се пренасяше нагоре.

          Тук подзаглавието е второстепенно: то обяснява нещо, което снимките
          отдолу и без това показват. По-добре да го няма, отколкото да лежи
          върху заглавието. */}
      <div className="flex items-end justify-between gap-3">
        <h2 className="display shrink-0 text-[22px]">Lookbook</h2>
        <span className="mb-1 hidden truncate text-[12.5px] text-ink-45 min-[340px]:inline">
          визии от хората тук
        </span>
      </div>

      {/* ── Категориите ─────────────────────────────────────────────────────
          Хоризонтален ред, който се влачи. Няма падащо меню: менюто крие
          какво има вътре, а точно това трябва да се види. */}
      <div className="-mx-5 mt-3 overflow-x-auto px-5 pb-1">
        <div className="flex gap-2">
          <Chip active={category === null} onClick={() => setCategory(null)}>
            Всички
          </Chip>
          {STYLE_KEYS.map((key) => (
            <Chip
              key={key}
              active={category === key}
              onClick={() => setCategory(category === key ? null : key)}
            >
              {STYLE_LABELS[key].emoji} {STYLE_LABELS[key].label}
            </Chip>
          ))}
        </div>
      </div>

      {looks.length === 0 && !loading ? (
        <Patch material="paper" className="mt-4 px-5 py-7 text-center">
          {/* ═══ ПРАЗНОТО СЪСТОЯНИЕ КАЗВА ЗАЩО Е ПРАЗНО ═══

              „Още няма визии" оставя човека да мисли, че екранът е счупен —
              нали има хора с публични гардероби. Истината е друга: публичен
              гардероб дава само ПРАВОТО. Всяка визия влиза тук поотделно, с
              изрично натискане, и това е нарочно — публикуването на снимка с
              лице не бива да се получава по невнимание. */}
          <p className="text-[14px] leading-snug text-ink-45">
            Тук още няма визии в тази категория.
          </p>
          <p className="mt-2 text-[13px] leading-snug text-ink-25">
            Публичният гардероб сам по себе си не показва нищо. Всяка визия се
            пуска поотделно — отваряш я в гардероба и натискаш „Покажи в
            Lookbook“.
          </p>
        </Patch>
      ) : (
        <ul className="stagger mt-4 grid grid-cols-2 gap-3">
          {looks.map((look) => (
            <li key={look.id}>
              <Patch material="paper" className="overflow-hidden p-1.5">
                <div className="relative overflow-hidden rounded-[12px_9px_14px_8px] ring-2 ring-ink">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/lookbook/${look.id}/image`}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    className="aspect-[3/4] w-full object-cover"
                  />

                  {isStyleKey(look.category) && (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-semibold text-paper backdrop-blur-sm">
                      {STYLE_LABELS[look.category].emoji}{' '}
                      {STYLE_LABELS[look.category].label}
                    </span>
                  )}
                </div>

                {/* ═══ ДВЕ КОПЧЕТА, НЕ ТРИ ═══

                    „Запази" отпадна. Три действия под всяка снимка при две
                    колонки на телефон значи шест мънички цели за палец на
                    един екран — и нито едно от тях не е ясно кое е главното.

                    Останаха харесването (тихо, вляво) и remix (лаймово,
                    вдясно). Второто е ЕДИНСТВЕНОТО, което води някъде: взима
                    дрехата от тази визия и я слага направо в стъпка 2 на нова
                    проба. Затова изглежда като копче, а харесването — не.

                    Иконите са начертани, не емоджита: емоджито се рисува от
                    системата, изглежда различно на всеки телефон и цветът му
                    не се управлява. */}
                <div className="mt-2 flex items-center justify-between gap-2 px-0.5 pb-0.5">
                  <button
                    aria-label={look.liked ? 'Махни харесването' : 'Харесай'}
                    aria-pressed={look.liked}
                    disabled={look.mine}
                    onClick={() => void toggleLike(look)}
                    className={cn(
                      'pressable flex h-9 items-center gap-1 rounded-full px-2',
                      'transition-colors duration-[var(--dur-menu)] ease-[var(--ease-out)]',
                      look.liked ? 'text-danger' : 'text-ink-45',
                      look.mine && 'pointer-events-none opacity-30',
                    )}
                  >
                    <HeartIcon filled={look.liked} />
                    <span className="min-w-3 text-[12px] font-semibold tabular-nums">
                      {look.likeCount > 0 ? look.likeCount : ''}
                    </span>
                  </button>

                  <button
                    aria-label="Пробвай тази дреха върху себе си"
                    onClick={() => router.push(`${R.tryOn}?vdahnovenie=${look.id}`)}
                    className={cn(
                      'pressable flex h-9 items-center gap-1.5 rounded-full bg-lime pl-2.5 pr-3',
                      'text-[12px] font-semibold text-ink',
                      'shadow-[0_2px_0_var(--color-lime-deep)]',
                    )}
                  >
                    <RemixIcon className="size-[18px]" />
                    Remix
                  </button>
                </div>
              </Patch>
            </li>
          ))}
        </ul>
      )}

      {loading && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="skeleton aspect-[3/4] rounded-[var(--radius-card)]" />
          <div className="skeleton aspect-[3/4] rounded-[var(--radius-card)]" />
        </div>
      )}

      <div ref={sentinel} aria-hidden="true" className="h-1" />

      {end && looks.length > 0 && (
        <p className="mt-5 text-center text-[12.5px] text-ink-25">
          Това е всичко засега. Утре ще има още.
        </p>
      )}
    </section>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'pressable shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[12.5px] font-semibold',
        'transition-colors duration-[var(--dur-menu)] ease-[var(--ease-out)]',
        active ? 'bg-ink text-paper' : 'bg-paper-2 text-ink-70',
      )}
    >
      {children}
    </button>
  );
}
