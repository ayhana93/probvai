'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Patch } from '@/components/ui/patch';
import { Sheet } from '@/components/ui/sheet';
import { Sparks, Zigzag } from '@/components/ui/scribble';
import { HeartIcon, RemixIcon, CrossIcon } from '@/components/ui/icons';
import { STYLE_KEYS, STYLE_LABELS, isStyleKey, type StyleKey } from '@/lib/styles';
import { cn } from '@/lib/cn';
import { useMe } from '@/lib/use-me';
import { dropCache, readCache, writeCache } from '@/lib/cache';
import { R } from '@/lib/routes';

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
  favorited: boolean;
  published: boolean;
  /** Моя проба ли е. Чуждите идват от харесаните в Lookbook. */
  mine: boolean;
};

/**
 * Чип за филтриране.
 *
 * Един и същ размер и форма за всички — включително за „Любими" с иконата.
 * Различната височина между съседни чипове се вижда веднага, дори човек да
 * не знае какво го дразни.
 */
function FilterChip({
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
        'pressable flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5',
        'text-[12.5px] font-semibold',
        'transition-colors duration-[var(--dur-menu)] ease-[var(--ease-out)]',
        active ? 'bg-ink text-paper' : 'bg-paper-2 text-ink-70',
      )}
    >
      {children}
    </button>
  );
}

/**
 * Едно от четирите действия под снимката на цял екран.
 *
 * ═══ ЕДНАКВИ ОТВЪН, РАЗЛИЧНИ ОТВЪТРЕ ═══
 *
 * Размерът, отстоянията и надписът не зависят от състоянието — мени се само
 * цветът. Затова редът не мърда, когато нещо се включи или изключи, а
 * състоянието пак се вижда от разстояние.
 */
function SheetAction({
  label,
  active,
  activeClass,
  danger,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  activeClass?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'pressable flex h-[68px] flex-col items-center justify-center gap-1.5 rounded-2xl px-1',
        'transition-colors duration-[var(--dur-menu)] ease-[var(--ease-out)]',
        active
          ? (activeClass ?? 'bg-paper text-ink')
          : danger
            ? 'bg-danger/20 text-danger-soft'
            : 'bg-paper/12 text-paper',
        disabled && 'pointer-events-none opacity-35',
      )}
    >
      {children}
      <span className="text-[11.5px] font-semibold leading-none">{label}</span>
    </button>
  );
}

/** Кошчето. Само тук — затова живее при екрана, а не в общия комплект. */
function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.6 6.6c4.9-.4 9.9-.4 14.8 0" />
      <path d="M9.4 6.4c-.1-.8-.1-1.5 0-2 .1-.9.8-1.4 1.6-1.4h2c.8 0 1.5.5 1.6 1.4.1.5.1 1.2 0 2" />
      <path d="M6.4 8.6c.3 3.9.6 7.7 1 11.5 3.1.3 6.2.3 9.3 0 .4-3.8.7-7.6 1-11.5" />
      <path d="M10.4 11.4c.1 2 .1 4 0 5.9M13.6 11.4c-.1 2-.1 4 0 5.9" />
    </svg>
  );
}

/** Колко трябва да се задържи, за да значи „изтрий". */
const HOLD_MS = 520;

function Tile({
  item,
  showLookbook,
  onOpen,
  onHold,
  onFavorite,
}: {
  item: Item;
  /** Скрита ли е галерията. Тогава значката „В Lookbook" няма какво да каже. */
  showLookbook: boolean;
  onOpen: () => void;
  onHold: () => void;
  onFavorite: () => void;
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
    /**
     * ═══ ЗАЩО СЪРЦЕТО Е ИЗВЪН ПЛОЧКАТА, А НЕ В НЕЯ ═══
     *
     * Плочката е `<button>`. Копче в копче е невалиден HTML и браузърите се
     * разминават какво правят с натискането. Затова сърцето е СЕСТРА на
     * плочката, сложена върху ъгъла ѝ.
     */
    <div className="relative">
    <button
      className="block w-full text-left"
      onPointerDown={() => {
        fired.current = false;
        setHolding(true);
        // Чуждата визия не се трие оттук — тя не е наша. Махането ѝ е
        // отхаресване, а то е на сърцето.
        if (!item.mine) return;
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

        {/* ═══ ЗНАЧКИТЕ ═══

            „В Lookbook" беше лаймово кръгче с емоджи ✨ — жълто на светла
            снимка, тоест не се виждаше. Сега е тъмно кръгче с лаймов знак:
            тъмното държи контраста върху ВСЯКА снимка, а лаймът остава
            цветът, който значи „публично".

            Надписът „воден знак" го няма. Той казваше на човека нещо, което
            и без това вижда върху самата снимка, и то с лилаво петно точно
            там, където гледа. Копчето „Махни водния знак" стои на екрана с
            резултата — там има смисъл, защото там може да се направи нещо. */}
        {!item.mine && (
          <span className="absolute bottom-3 left-3 rounded-full bg-ink/80 px-2 py-1 text-[10px] font-semibold text-lime backdrop-blur-sm">
            Lookbook
          </span>
        )}

        {item.mine && item.published && showLookbook && (
          <span
            title="В Lookbook"
            aria-label="В Lookbook"
            className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-ink/85 text-lime backdrop-blur-sm"
          >
            <Sparks className="h-3 w-4" />
          </span>
        )}


      </Patch>
    </button>

      {/* ═══ ЗАЩО СЪРЦЕТО Е ТУК, А НЕ САМО НА ЦЯЛ ЕКРАН ═══

          Първо беше единствено в екрана на цял размер. Прегледах логовете на
          продукцията: за цял час никой не е стигнал до него — нито едно
          обръщение. Гардеробът беше отварян, филтърът „Любими" — натискан, и
          празен. Тоест начин за отбелязване имаше, но нямаше как да се
          намери.

          Сега стои върху всяка плочка и се вижда, преди да е натиснато нещо.
          Тъмното кръгче държи контраста над всяка снимка — светло сърце върху
          светъл пясък изчезва. */}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onFavorite();
        }}
        aria-label={item.favorited ? 'Махни от любими' : 'Добави в любими'}
        aria-pressed={item.favorited}
        className={cn(
          'pressable absolute bottom-3 right-3 grid size-9 place-items-center rounded-full',
          'bg-ink/70 backdrop-blur-sm',
          'transition-colors duration-[var(--dur-menu)] ease-[var(--ease-out)]',
          item.favorited ? 'text-danger-soft' : 'text-white/70',
        )}
      >
        <HeartIcon filled={item.favorited} className="size-[18px]" />
      </button>
    </div>
  );
}

export default function GarderobPage() {
  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(true);
  /**
   * ═══ ЕДНО СЪСТОЯНИЕ ЗА ВСИЧКИ ФИЛТРИ ═══
   *
   * „Любими" стои в същия ред като категориите, защото за човека е същото
   * нещо — начин да види по-малко наведнъж. Държано като отделно булево до
   * `category`, двете можеха да са включени едновременно и редът щеше да
   * показва два натиснати чипа, а списъкът — трето нещо.
   */
  const [filter, setFilter] = React.useState<'all' | 'fav' | StyleKey>('all');
  const [open, setOpen] = React.useState<Item | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<Item | null>(null);
  const [pendingCategory, setPendingCategory] = React.useState<Item | null>(null);
  const { me } = useMe();
  const router = useRouter();

  /**
   * ═══ ЗАЩО ГАРДЕРОБЪТ НЕ ТРЪГВА ОТ СКЕЛЕТИ ═══
   *
   * Дотук всяко влизане започваше с празна решетка и две сиви плочки, дори
   * човек да е бил тук преди пет секунди. Снимките са едни и същи; мигането
   * не носи информация, а само чакане.
   *
   * Сега показаното веднъж се пази в паметта на раздела. Влизането го изкарва
   * ВЕДНАГА, а сървърът се пита тихо отзад — има ли промяна, решетката се
   * обновява без скелети.
   *
   * ⚠ Тихото питане не е излишно: адресите към снимките са подписани и
   *   изтичат. Без него запомнената решетка щеше да покаже счупени снимки
   *   след около час.
   */
  React.useEffect(() => {
    let alive = true;

    const query =
      filter === 'all' ? '' : filter === 'fav' ? '?favorite=1' : `?category=${filter}`;
    const cacheKey = `wardrobe:${filter}`;
    const stored = readCache<Item[]>(cacheKey);

    if (stored) {
      setItems(stored);
      setLoading(false);
    } else {
      setItems([]);
      setLoading(true);
    }

    void fetch(`/api/wardrobe${query}`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : { items: [] }))
      .then((data: { items: Item[] }) => {
        if (!alive) return;
        writeCache(cacheKey, data.items);
        setItems(data.items);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [filter]);

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

  /**
   * Публикуване от гардероба.
   *
   * ═══ ЗАЩО НЕ Е САМО НА ЕКРАНА С РЕЗУЛТАТА ═══
   *
   * Досега „Покажи в Lookbook" стоеше единствено под току-що готовата проба.
   * Излезеш ли от онзи екран, връщане назад няма — визията не може да се
   * публикува НИКОГА. Оттам и празната галерия: не че нищо не се харесва,
   * а че прозорецът, в който изобщо може да се публикува, трае една минута.
   */
  async function togglePublished(item: Item): Promise<void> {
    const next = !item.published;

    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, published: next } : entry,
      ),
    );
    setOpen((current) =>
      current && current.id === item.id ? { ...current, published: next } : current,
    );

    try {
      const response = await fetch(`/api/generate/${item.id}/publish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ published: next }),
      });
      if (!response.ok) throw new Error('отказано');

      /**
       * ═══ ЗАЩО ПАМЕТТА НА LOOKBOOK СЕ ИЗХВЪРЛЯ ТУК ═══
       *
       * Галерията пази страниците си, за да не мига при всяко връщане. След
       * това натискане обаче запомненото вече не е вярно:
       *
       *   при публикуване — новата визия липсва в него;
       *   при махане      — старата стои, а снимката ѝ вече дава 404. Точно
       *                     оттам идваше празното каре с въпросителна.
       *
       * Затова паметта се изхвърля и галерията се сглобява наново при
       * следващото показване — тоест веднага, щом човек се върне назад.
       */
      dropCache('lookbook:');
    } catch {
      // Връщаме показаното към истината. Мълчаливо „публикувано", което не е
      // публикувано, е по-лошо от видима грешка.
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, published: !next } : entry,
        ),
      );
      setOpen((current) =>
        current && current.id === item.id ? { ...current, published: !next } : current,
      );
    }
  }

  /**
   * Любима.
   *
   * Показва се веднага и се връща назад при отказ — копче, което чака
   * мрежата, се натиска два пъти. Обновяват се и списъкът, и отвореното
   * копие: те са две части от едно състояние и разминаването им личи в мига,
   * в който екранът се затвори.
   */
  async function toggleFavorite(item: Item): Promise<void> {
    const next = !item.favorited;
    // Филтърът „Любими" се смята на сървъра — запомненото за него става
    // невярно още с това натискане.
    dropCache('wardrobe:');

    const apply = (value: boolean) => {
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, favorited: value } : entry,
        ),
      );
      setOpen((current) =>
        current && current.id === item.id ? { ...current, favorited: value } : current,
      );
    };

    apply(next);

    /**
     * ═══ ЕДНО СЪРЦЕ, ДВА ПЪТЯ ═══
     *
     * Своята проба се отбелязва с `favorited_at`. Чуждата визия няма как —
     * тя не е наш ред. За нея същото натискане маха харесването в Lookbook,
     * а с това тя излиза и от „Любими".
     *
     * За човека това е едно действие. Разликата е наша работа.
     */
    try {
      const response = item.mine
        ? await fetch(`/api/generate/${item.id}/favorite`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ favorited: next }),
          })
        : await fetch(`/api/lookbook/${item.id}/like`, { method: 'POST' });

      if (!response.ok) throw new Error('отказано');

      // Отхаресаната чужда визия няма какво да прави в списъка — тя е тук
      // само защото е харесана.
      if (!item.mine && !next) {
        setItems((current) => current.filter((entry) => entry.id !== item.id));
        setOpen((current) => (current && current.id === item.id ? null : current));
      }
    } catch {
      apply(!next);
    }
  }

  async function remove(item: Item): Promise<void> {
    // Изтритата проба не бива да се появи пак от паметта при следващо
    // влизане. Тя вече я няма и в Lookbook.
    dropCache('wardrobe:');
    dropCache('lookbook:');
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    setPendingDelete(null);
    try {
      await fetch(`/api/generate/${item.id}`, { method: 'DELETE' });
    } catch {
      // Изтриването ще се повтори при следващо влизане.
    }
  }

  const empty = !loading && items.length === 0 && filter === 'all';

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
          href={R.tryOn}
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
        {items.length} {items.length === 1 ? 'проба' : 'проби'} · сърцето слага
        в любими · натисни за цял екран
      </p>

      {/* ── Филтрите ──────────────────────────────────────────────────────
          Пробите се подреждат сами по категория. Тези копчета само
          стесняват показаното. „Любими" е втора — веднага след „Всички",
          защото е единствената, която човек си слага сам. */}
      <div className="-mx-5 mt-4 overflow-x-auto px-5 pb-1">
        <div className="flex gap-2">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
            Всички
          </FilterChip>

          <FilterChip active={filter === 'fav'} onClick={() => setFilter('fav')}>
            <HeartIcon filled={filter === 'fav'} className="size-3.5" />
            Любими
          </FilterChip>

          {STYLE_KEYS.map((key) => (
            <FilterChip
              key={key}
              active={filter === key}
              onClick={() => setFilter(filter === key ? 'all' : key)}
            >
              {STYLE_LABELS[key].emoji} {STYLE_LABELS[key].label}
            </FilterChip>
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
          {filter === 'fav'
            ? me?.lookbookEnabled
              ? 'Още нямаш любими. Натисни сърцето върху проба — или върху визия в Lookbook.'
              : 'Още нямаш любими. Натисни сърцето върху проба.'
            : 'Няма проби в тази категория.'}
        </p>
      ) : (
        <ul className="stagger mt-5 grid grid-cols-2 gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <Tile
                item={item}
                showLookbook={me?.lookbookEnabled ?? false}
                onOpen={() => setOpen(item)}
                onHold={() => setPendingDelete(item)}
                onFavorite={() => void toggleFavorite(item)}
              />
            </li>
          ))}
        </ul>
      )}

      {/* ── Цял екран ────────────────────────────────────────────────────

          ═══ ЗАЩО НАДПИСИТЕ НЕ СЕ МЕНЯТ ═══

          Копчето казваше „Покажи в Lookbook", а след натискане „✨ В
          Lookbook" — по-къс надпис. Реда се преподреждаше под пръста и
          съседните копчета скачаха на друго място. Смяна на дума под пръста
          е най-бързият начин един интерфейс да изглежда любителски.

          Сега надписът е един и същ винаги, а състоянието се вижда по ЦВЯТ.
          Четирите копчета са в решетка от равни части: каквото и да се
          случи вътре в тях, редът не мърда.

          ═══ ЗАЩО „ЗАТВОРИ" НЕ Е ПЕТО КОПЧЕ ═══

          То не е действие върху снимката, а изход от екрана. Смесено между
          останалите, се натиска по погрешка вместо „Изтрий". Затова е
          кръстче в ъгъла — там, където всеки го търси. */}
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
            className="enter-pop m-auto max-h-[68dvh] max-w-full object-contain px-3"
          />

          <button
            onClick={() => setOpen(null)}
            aria-label="Затвори"
            className="pressable absolute right-4 grid size-11 place-items-center rounded-full bg-paper/15 text-paper backdrop-blur-sm"
            style={{ top: 'max(16px, calc(env(safe-area-inset-top) + 8px))' }}
          >
            <CrossIcon className="size-5" />
          </button>

          {/* ═══ ЧУЖДАТА ВИЗИЯ ИМА ДРУГИ ДЕЙСТВИЯ ═══

              Тя не се трие, не ѝ се сменя категорията и не се публикува —
              не е наша. Остават две: сърцето (маха харесването и с това я
              маха оттук) и „Пробвай", което взима дрехата от нея.

              Копчетата са в решетка по броя си, не заковано на четири:
              две копчета, разтеглени на четири колони, изглеждат като
              такива, на които им липсва нещо. */}
          {/* Броят колони следва броя копчета, не обратното. Три копчета,
              разтеглени на четири колони, оставят празно място, което се чете
              като липсващо копче. */}
          <div
            className={cn(
              'grid gap-2 px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-2',
              !open.mine
                ? 'grid-cols-2'
                : me?.lookbookEnabled
                  ? 'grid-cols-4'
                  : 'grid-cols-3',
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <SheetAction
              label="Любима"
              active={open.favorited}
              activeClass="bg-danger text-white"
              onClick={() => void toggleFavorite(open)}
            >
              <HeartIcon filled={open.favorited} />
            </SheetAction>

            {open.mine ? (
              <>
                {/* Скрита галерия значи и скрито копче за публикуване.
                    Копче, което пуска визия в галерия, която никой не може
                    да отвори, е обещание без покритие. */}
                {me?.lookbookEnabled && (
                  <SheetAction
                    label="Lookbook"
                    active={open.published}
                    activeClass="bg-lime text-ink"
                    disabled={!me.profile.wardrobePublic}
                    onClick={() => void togglePublished(open)}
                  >
                    <Sparks className="h-4 w-6" />
                  </SheetAction>
                )}

                <SheetAction
                  label="Категория"
                  onClick={() => {
                    setPendingCategory(open);
                    setOpen(null);
                  }}
                >
                  <RemixIcon />
                </SheetAction>

                <SheetAction
                  label="Изтрий"
                  danger
                  onClick={() => {
                    setPendingDelete(open);
                    setOpen(null);
                  }}
                >
                  <TrashIcon />
                </SheetAction>
              </>
            ) : (
              <SheetAction
                label="Пробвай"
                activeClass="bg-lime text-ink"
                active
                onClick={() => router.push(`${R.tryOn}?vdahnovenie=${open.id}`)}
              >
                <RemixIcon />
              </SheetAction>
            )}
          </div>

          {open.mine && me?.lookbookEnabled && !me.profile.wardrobePublic && (
            <p
              className="px-6 pb-[max(20px,env(safe-area-inset-bottom))] text-center text-[12px] leading-snug text-white/45"
              onClick={(event) => event.stopPropagation()}
            >
              За Lookbook гардеробът трябва да е публичен — от настройките.
            </p>
          )}
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
