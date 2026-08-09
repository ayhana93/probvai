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
 * Сега страниците живеят в паметта на раздела (`lib/cache`). Връщането
 * показва същото, на същото място, мигновено. Ново разбъркване има при ново
 * отваряне на приложението, не при всяко натискане на „назад".
 *
 * ═══ КАК СЕ ПОЯВЯВАТ НОВИ ВИЗИИ ═══
 *
 * На всеки петнайсет секунди — и веднага щом разделът се върне на преден
 * план — тихо се пита какво е публикувано СЛЕД последното, което знаем.
 * Новите визии влизат ОТГОРЕ, но само ако човекът е горе. Гледа ли по-надолу,
 * те чакат и се появява малко копче „нови визии". Съдържание, което скача под
 * пръста, е по-лошо от съдържание, което закъснява.
 *
 * ═══ КАК ИЗЧЕЗВАТ СВАЛЕНИТЕ ═══
 *
 * Свали ли собственикът визия от галерията, снимката ѝ спира да се дава и
 * останалите виждаха празно каре с въпросителна. Сега всяка снимка, която не
 * се зареди, маха визията си от списъка и от паметта — тихо, без съобщение.
 * Няма причина да се обяснява отсъствието на нещо, което човекът не е
 * поглеждал.
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { PhotoViewer } from '@/components/photo-viewer';
import { HeartIcon, RemixIcon } from '@/components/ui/icons';
import { STYLE_KEYS, STYLE_LABELS, type StyleKey } from '@/lib/styles';
import { cn } from '@/lib/cn';
import { readCache, writeCache } from '@/lib/cache';
import { R } from '@/lib/routes';

type Look = {
  id: string;
  category: string | null;
  likeCount: number;
  liked: boolean;
  mine: boolean;
};

type Page = {
  seed: string | null;
  nextCursor: string | null;
  /** Кога е публикувана най-новата визия в галерията. Идва само при първата
   *  страница и при проверката за ново. */
  newest: string | null;
  items: Look[];
};

/** Колко често се проверява за нови визии, докато разделът се гледа. */
const POLL_MS = 15_000;

/** Докъде „човекът е горе" — под това ново съдържание може да влезе само. */
const TOP_PX = 240;

/**
 * Паметта между влизанията.
 *
 * ═══ ЗАЩО Е В ОБЩИЯ СКЛАД, А НЕ ТУК ═══
 *
 * Беше обикновена променлива на този файл и работеше — докато галерията
 * беше единствената, която я пипа. Публикуването обаче става в ГАРДЕРОБА, а
 * оттам няма как да се посегне на променлива, скрита в друг модул. Резултат:
 * човек публикува визия, връща се и не я вижда; маха я — а тя стои с празно
 * каре и въпросителна, защото снимката вече дава 404.
 *
 * Затова паметта живее в `lib/cache` и има ОБЩ ПРЕФИКС: `dropCache('lookbook:')`
 * от гардероба я изхвърля цялата, независимо коя категория е била отворена.
 */
type Cached = {
  seed: string;
  items: Look[];
  cursor: string | null;
  end: boolean;
  /** Котвата за „има ли ново" — пази се, за да не се губи при връщане. */
  newest: string | null;
};

const cacheKey = (category: StyleKey | null) => `lookbook:${category ?? 'all'}`;

/**
 * Слепва два списъка, без една визия да влезе два пъти.
 *
 * ═══ ЗАЩО НЕ СТИГА ПРОВЕРКАТА ПРЕДИ ИЗВИКВАНЕТО ═══
 *
 * Списъкът се пълни от три страни: скролването добавя отдолу, тихата
 * проверка слага отгоре, а копчето „нови визии" изсипва изчакалите. Всяка от
 * трите гледа какво има В МОМЕНТА и решава кое е ново — но между гледането и
 * записа минава мрежа. Две проверки, тръгнали една след друга, виждат едно и
 * също „в момента" и слагат едни и същи визии по два пъти. На екрана това са
 * две еднакви плочки; в React — два реда с еднакъв ключ.
 *
 * Затова последната дума е тук, вътре в самото обновяване на списъка, където
 * `current` вече е истината, а не снимка отпреди секунда.
 */
function merge(before: Look[], after: Look[]): Look[] {
  const seen = new Set(before.map((item) => item.id));
  const extra = after.filter((item) => !seen.has(item.id));
  return extra.length === 0 ? before : [...before, ...extra];
}

export function Lookbook() {
  const router = useRouter();
  const [category, setCategory] = React.useState<StyleKey | null>(null);

  const key = cacheKey(category);
  const saved = readCache<Cached>(key);

  const [looks, setLooks] = React.useState<Look[]>(saved?.items ?? []);
  const [seed, setSeed] = React.useState<string | null>(saved?.seed ?? null);
  const [cursor, setCursor] = React.useState<string | null>(saved?.cursor ?? null);
  const [end, setEnd] = React.useState(saved?.end ?? false);
  const [loading, setLoading] = React.useState(!saved);
  const [fresh, setFresh] = React.useState<Look[]>([]);
  const [open, setOpen] = React.useState<Look | null>(null);

  /**
   * Котвата за „има ли ново".
   *
   * Държи се в `ref`, а не в състояние: тихата проверка я чете и я мести, но
   * от нея не зависи нищо на екрана. В състояние би пускала прерисуване на
   * цялата галерия на всеки петнайсет секунди — за число, което никой не вижда.
   */
  const newest = React.useRef<string | null>(saved?.newest ?? null);

  const sentinel = React.useRef<HTMLDivElement | null>(null);
  // Пази от две едновременни искания за една и съща страница.
  const busy = React.useRef(false);

  /**
   * Показаното в момента, четимо ИЗВЪН прерисуването.
   *
   * Тихата проверка отдолу трябва да знае кои визии вече са на екрана, за да
   * вземе само непознатите. Четенето им през `looks` би вързало проверката за
   * всяко състояние и таймерът щеше да се пуска наново при всяко харесване.
   */
  const shown = React.useRef<Look[]>(looks);
  const waiting = React.useRef<Look[]>(fresh);
  React.useEffect(() => {
    shown.current = looks;
  }, [looks]);
  React.useEffect(() => {
    waiting.current = fresh;
  }, [fresh]);

  // Показаното се записва в паметта при всяка промяна — така връщането
  // намира точно него, без да пита сървъра.
  React.useEffect(() => {
    if (looks.length > 0 && seed) {
      writeCache<Cached>(key, {
        seed,
        items: looks,
        cursor,
        end,
        newest: newest.current,
      });
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
          if (page.seed) setSeed(page.seed);
          if (page.newest) newest.current = page.newest;
          setCursor(page.nextCursor);
          setEnd(page.nextCursor === null);
          setLooks((current) =>
            options.fresh ? page.items : merge(current, page.items),
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
    const stored = readCache<Cached>(cacheKey(category));
    if (stored) {
      setLooks(stored.items);
      setSeed(stored.seed);
      setCursor(stored.cursor);
      setEnd(stored.end);
      newest.current = stored.newest;
      setLoading(false);
      return;
    }

    setLooks([]);
    setFresh([]);
    setCursor(null);
    setSeed(null);
    setEnd(false);
    newest.current = null;
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
   * ═══ ЗАЩО ПИТА „СЛЕД КОГА", А НЕ „ДАЙ ПЪРВА СТРАНИЦА" ═══
   *
   * Първо беше второто: ново семе, първа страница, и за нови се смятаха
   * непознатите. При двайсет визии минаваше. При хиляда всяка проверка връща
   * дванайсет случайни, почти всички непознати — и на всеки петнайсет секунди
   * галерията растеше със СТАРО съдържание, а копчето обявяваше „12 нови
   * визии", без някой да е публикувал нищо.
   *
   * Сега се праща моментът, до който знаем всичко. Сървърът връща само
   * публикуваното след него — тоест наистина новото.
   */
  React.useEffect(() => {
    const check = () => {
      if (document.visibilityState !== 'visible' || busy.current) return;
      // Още не сме заредили нищо — няма спрямо какво да е „ново".
      if (!newest.current) return;

      const params = new URLSearchParams({ since: newest.current });
      if (category) params.set('category', category);

      void fetch(`/api/lookbook?${params}`, { cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : null))
        .then((page: Page | null) => {
          if (!page || page.items.length === 0) return;
          if (page.newest) newest.current = page.newest;

          const known = new Set(
            [...shown.current, ...waiting.current].map((item) => item.id),
          );
          const added = page.items.filter((item) => !known.has(item.id));
          if (added.length === 0) return;

          // Горе — влизат веднага. По-надолу — чакат копчето, за да не
          // подскочи редът под пръста.
          if (window.scrollY < TOP_PX) {
            setLooks((current) => merge(added, current));
          } else {
            setFresh((current) => merge(current, added));
          }
        })
        .catch(() => undefined);
    };

    // Веднага при показване на екрана, после през равни промеждутъци.
    // Първото е важното: човек, който се връща в приложението, очаква да
    // види новото сега, а не след петнайсет секунди.
    check();
    const timer = setInterval(check, POLL_MS);
    document.addEventListener('visibilitychange', check);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [category]);

  /**
   * Маха визия, чиято снимка вече я няма.
   *
   * ═══ ЗАЩО НА „НЕ СЕ ЗАРЕДИ", А НЕ НА ОТДЕЛНА ПРОВЕРКА ═══
   *
   * Списъкът се сглобява веднъж и после стои. Между сглобяването и гледането
   * собственикът може да е свалил визията си — тогава `/image` връща 404 и
   * браузърът рисува счупена снимка. Питане „още ли са живи тези дванайсет"
   * би било дванайсет заявки за нещо, което почти никога не се случва.
   *
   * Самото зареждане на снимката вече е тази проверка. Провали ли се, редът
   * излиза — и от показаното, и от запомненото, за да не се върне при
   * следващото влизане.
   */
  const forget = React.useCallback(
    (id: string) => {
      setLooks((current) => current.filter((item) => item.id !== id));
      setFresh((current) => current.filter((item) => item.id !== id));
      setOpen((current) => (current && current.id === id ? null : current));

      const stored = readCache<Cached>(key);
      if (stored) {
        writeCache<Cached>(key, {
          ...stored,
          items: stored.items.filter((item) => item.id !== id),
        });
      }
    },
    [key],
  );

  function showFresh(): void {
    setLooks((current) => merge(fresh, current));
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
                    onError={() => forget(look.id)}
                    className="no-save aspect-[4/5] w-full object-cover"
                  />
                </button>

                {/* ═══ ЗАЩО ВЪРХУ СНИМКАТА НЯМА ЕТИКЕТ ═══

                    Категорията стоеше в горния ляв ъгъл на всяка визия.
                    Полза нула: филтърът отгоре вече казва какво гледаш, а на
                    „Всички" етикетът повтаря нещо, което се вижда от самата
                    дреха. Цена — тъмно петно върху всяка снимка, точно там,
                    където най-често е лицето. */}

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
                    /* Прозрачно, като сърцето отляво. Лаймовата хапка беше
                       най-яркото нещо на екрана и се повтаряше на всяка
                       плочка — двайсет копчета „купи" върху галерия. Сега
                       двете действия тежат еднакво и снимката е главната. */
                    className="pressable flex h-8 items-center gap-1 rounded-full px-1.5 text-[11.5px] font-semibold text-white/85"
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
