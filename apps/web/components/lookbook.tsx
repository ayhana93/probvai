/**
 * LOOKBOOK
 *
 * ═══ КАКВО НЕ Е ═══
 *
 * Няма профили. Няма последователи. Няма чат. Няма коментари. Под всяка
 * визия има точно ДВЕ неща:
 *
 *   Харесване — тихо. Слага визията и в „Любими" в гардероба.
 *   Remix     — взима дрехата от нея и я слага в стъпка 2 на нова проба.
 *
 * Второто е единственото, което води някъде, и затова изглежда като копче.
 *
 * ═══ ЗАЩО НЯМА ИМЕНА ПОД СНИМКИТЕ ═══
 *
 * Щом има име, има профил. Щом има профил, има последователи, после
 * съобщения, после модерация. Галерията показва ВИЗИИ, не хора — и точно
 * затова остава лека.
 *
 * ═══ ЗАЩО НЕ СЕ ЗАРЕЖДА НАНОВО ПРИ ВСЯКО ВЛИЗАНЕ ═══
 *
 * Галерията беше на екрана при всяко връщане към началото, и всеки път
 * тръгваше от нула: празно, скелети, ново разбъркване. Човек, отворил проба
 * и върнал се назад, губеше мястото си и виждаше друга подредба — все едно е
 * в друго приложение.
 *
 * Сега страниците живеят в паметта на раздела (`cache` отдолу). Връщането
 * показва същото, на същото място, мигновено. Ново разбъркване има при ново
 * отваряне на приложението, не при всяко натискане на „назад".
 *
 * ═══ КАК СЕ ПОЯВЯВАТ НОВИ ВИЗИИ ═══
 *
 * На всеки половин минута, докато разделът се гледа, тихо се пита за първа
 * страница с ново семе. Непознатите визии се слагат ОТГОРЕ — но само ако
 * човекът е горе. Гледа ли по-надолу, те чакат и се появява малко копче
 * „нови визии". Съдържание, което скача под пръста, е по-лошо от съдържание,
 * което закъснява.
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { PhotoViewer } from '@/components/photo-viewer';
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

/** Колко често се проверява за нови визии, докато разделът се гледа. */
const POLL_MS = 30_000;

/** Докъде „човекът е горе" — под това ново съдържание може да влезе само. */
const TOP_PX = 240;

/**
 * Паметта между влизанията.
 *
 * Обикновена променлива на модула, не хранилище: живее колкото разделът и
 * изчезва при презареждане. Точно това искаме — „назад" пази мястото,
 * ново отваряне започва наново.
 */
const cache = new Map<
  string,
  { seed: string; items: Look[]; cursor: string | null; end: boolean }
>();

export function Lookbook() {
  const router = useRouter();
  const [category, setCategory] = React.useState<StyleKey | null>(null);

  const key = category ?? 'all';
  const saved = cache.get(key);

  const [looks, setLooks] = React.useState<Look[]>(saved?.items ?? []);
  const [seed, setSeed] = React.useState<string | null>(saved?.seed ?? null);
  const [cursor, setCursor] = React.useState<string | null>(saved?.cursor ?? null);
  const [end, setEnd] = React.useState(saved?.end ?? false);
  const [loading, setLoading] = React.useState(!saved);
  const [fresh, setFresh] = React.useState<Look[]>([]);
  const [open, setOpen] = React.useState<Look | null>(null);

  const sentinel = React.useRef<HTMLDivElement | null>(null);
  // Пази от две едновременни искания за една и съща страница.
  const busy = React.useRef(false);

  // Показаното се записва в паметта при всяка промяна — така връщането
  // намира точно него, без да пита сървъра.
  React.useEffect(() => {
    if (looks.length > 0 && seed) {
      cache.set(key, { seed, items: looks, cursor, end });
    }
  }, [key, looks, seed, cursor, end]);

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

  // Първо зареждане — само когато в паметта няма нищо за тази категория.
  React.useEffect(() => {
    const stored = cache.get(category ?? 'all');
    if (stored) {
      setLooks(stored.items);
      setSeed(stored.seed);
      setCursor(stored.cursor);
      setEnd(stored.end);
      setLoading(false);
      return;
    }

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

  /**
   * Тихата проверка за нови визии.
   *
   * Пита се с НОВО семе: подредбата е случайна и „първа страница" при старото
   * семе би върнала същите визии. Взимат се само непознатите.
   */
  React.useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible' || busy.current) return;

      const params = new URLSearchParams();
      if (category) params.set('category', category);

      void fetch(`/api/lookbook?${params}`, { cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : null))
        .then((page: Page | null) => {
          if (!page) return;

          setLooks((current) => {
            const known = new Set(current.map((item) => item.id));
            const added = page.items.filter((item) => !known.has(item.id));
            if (added.length === 0) return current;

            // Горе — влизат веднага. По-надолу — чакат копчето, за да не
            // подскочи редът под пръста.
            if (window.scrollY < TOP_PX) return [...added, ...current];

            setFresh((waiting) => {
              const seen = new Set(waiting.map((item) => item.id));
              return [...waiting, ...added.filter((item) => !seen.has(item.id))];
            });
            return current;
          });
        })
        .catch(() => undefined);
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [category]);

  function showFresh(): void {
    setLooks((current) => [...fresh, ...current]);
    setFresh([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

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
      const response = await fetch(`/api/lookbook/${look.id}/like`, { method: 'POST' });
      if (!response.ok) throw new Error('отказано');
    } catch {
      setLooks((current) => current.map((item) => (item.id === look.id ? look : item)));
    }
  }

  return (
    <section className="mt-7">
      <div className="flex items-end justify-between gap-3">
        <h2 className="display shrink-0 text-[22px]">Lookbook</h2>
        {fresh.length > 0 && (
          <button
            onClick={showFresh}
            className="pressable enter-rise mb-1 rounded-full bg-lime px-3 py-1.5 text-[12px] font-semibold text-ink shadow-[0_2px_0_var(--color-lime-deep)]"
          >
            {fresh.length} {fresh.length === 1 ? 'нова визия' : 'нови визии'}
          </button>
        )}
      </div>

      {/* ── Категориите ─────────────────────────────────────────────────────
          Хоризонтален ред, който се влачи. Няма падащо меню: менюто крие
          какво има вътре, а точно това трябва да се види. */}
      <div className="-mx-5 mt-3 overflow-x-auto px-5 pb-1">
        <div className="flex gap-2">
          <Chip active={category === null} onClick={() => setCategory(null)}>
            Всички
          </Chip>
          {STYLE_KEYS.map((styleKey) => (
            <Chip
              key={styleKey}
              active={category === styleKey}
              onClick={() => setCategory(category === styleKey ? null : styleKey)}
            >
              {STYLE_LABELS[styleKey].emoji} {STYLE_LABELS[styleKey].label}
            </Chip>
          ))}
        </div>
      </div>

      {looks.length === 0 && !loading ? (
        <div className="mt-4 rounded-[var(--radius-card)] bg-paper-2 px-5 py-7 text-center">
          {/* ═══ ПРАЗНОТО СЪСТОЯНИЕ КАЗВА ЗАЩО Е ПРАЗНО ═══

              „Още няма визии" оставя човека да мисли, че екранът е счупен —
              нали има хора с публични гардероби. Истината е друга: публичен
              гардероб дава само ПРАВОТО. Всяка визия влиза тук поотделно, с
              изрично натискане, и това е нарочно. */}
          <p className="text-[14px] leading-snug text-ink-45">
            Тук още няма визии в тази категория.
          </p>
          <p className="mt-2 text-[13px] leading-snug text-ink-25">
            Публичният гардероб сам по себе си не показва нищо. Всяка визия се
            пуска поотделно — отваряш я в гардероба и натискаш „Покажи в
            Lookbook“.
          </p>
        </div>
      ) : (
        /* ═══ ЗАЩО КАРТИТЕ СА БЕЗ РАМКА И БЕЗ РЕД ОТДОЛУ ═══

           Всяка визия стоеше в хартиено парче, а под снимката имаше отделен
           ред с копчета. Двете заедно правеха рамка от 30 пиксела около
           всяка снимка — на екран с две колонки това е повече рамка,
           отколкото съдържание.

           Сега снимката е цялата карта, а действията лежат ВЪРХУ нея, на
           тъмна ивица долу. Галерията изглежда като галерия, а копчетата са
           точно там, където е и палецът. */
        <ul className="stagger mt-4 grid grid-cols-2 gap-2.5">
          {looks.map((look) => (
            <li key={look.id}>
              <div className="relative overflow-hidden rounded-[18px_12px_20px_11px] bg-paper-3 ring-2 ring-ink">
                {/* Натискането отваря визията на цял екран. Обвивката поема
                    натискането вместо снимката — така задържането не отваря
                    системното „Запази снимката". */}
                <button
                  type="button"
                  onClick={() => setOpen(look)}
                  aria-label="Отвори на цял екран"
                  className="block w-full"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/lookbook/${look.id}/image`}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    onContextMenu={(event) => event.preventDefault()}
                    className="no-save aspect-[4/5] w-full object-cover"
                  />
                </button>

                {isStyleKey(look.category) && (
                  <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-ink/75 px-2 py-0.5 text-[10px] font-semibold text-paper backdrop-blur-sm">
                    {STYLE_LABELS[look.category].emoji}{' '}
                    {STYLE_LABELS[look.category].label}
                  </span>
                )}

                {/* Действията върху тъмна ивица. Преливането нагоре пази
                    четимостта и на светла снимка, без да я закрива. */}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-ink/85 to-transparent px-2 pb-2 pt-6">
                  <button
                    aria-label={look.liked ? 'Махни харесването' : 'Харесай'}
                    aria-pressed={look.liked}
                    disabled={look.mine}
                    onClick={() => void toggleLike(look)}
                    className={cn(
                      'pressable flex h-8 items-center gap-1 rounded-full px-1.5',
                      'transition-colors duration-[var(--dur-menu)] ease-[var(--ease-out)]',
                      look.liked ? 'text-danger-soft' : 'text-white/85',
                      look.mine && 'pointer-events-none opacity-40',
                    )}
                  >
                    <HeartIcon filled={look.liked} className="size-[18px]" />
                    <span className="min-w-2 text-[11.5px] font-semibold tabular-nums">
                      {look.likeCount > 0 ? look.likeCount : ''}
                    </span>
                  </button>

                  <button
                    aria-label="Пробвай тази дреха върху себе си"
                    onClick={() => router.push(`${R.tryOn}?vdahnovenie=${look.id}`)}
                    className="pressable flex h-8 items-center gap-1 rounded-full bg-lime pl-2 pr-2.5 text-[11.5px] font-semibold text-ink"
                  >
                    <RemixIcon className="size-4" />
                    Remix
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {loading && (
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <div className="skeleton aspect-[4/5] rounded-[18px_12px_20px_11px]" />
          <div className="skeleton aspect-[4/5] rounded-[18px_12px_20px_11px]" />
        </div>
      )}

      <div ref={sentinel} aria-hidden="true" className="h-1" />

      {end && looks.length > 0 && (
        <p className="mt-5 text-center text-[12.5px] text-ink-25">
          Това е всичко засега. Утре ще има още.
        </p>
      )}

      {/* Цял екран: само снимката. Без кръстче — натискане където и да е я
          затваря. `guard` маха системното „Запази снимката" при задържане. */}
      {open && (
        <PhotoViewer
          bare
          guard
          src={`/api/lookbook/${open.id}/image`}
          alt="Визия от Lookbook"
          onClose={() => setOpen(null)}
        />
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
