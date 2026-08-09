'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { quote, type PriceRules } from '@probvai/core/pricing';
import { Button } from '@/components/ui/button';
import { Patch } from '@/components/ui/patch';
import { Underscribble } from '@/components/ui/scribble';
import { cn } from '@/lib/cn';
import { readCache, writeCache } from '@/lib/cache';

/**
 * ЗАРЕЖДАНЕ НА ПРОБИ
 *
 * Един плъзгач, едно число, едно копче. Няма планове, няма таблици, няма
 * „най-популярен избор".
 *
 * Плъзгачът е нативен `<input type=range>` нарочно: върви на системата,
 * работи с клавиатура и с екранен четец без нито ред допълнителен код,
 * и не изпуска кадри при влачене.
 *
 * ═══ ЗАЩО ЦЕНАТА ВЕЧЕ НЕ Е ЗАПИСАНА ТУК ═══
 *
 * Беше: `PRICE_EUR = 0.2`, `MIN = 25`, `MAX = 200`. Средата междувременно
 * казваше таван 1000 — плъзгачът спираше на 200 без причина, а цената на
 * екрана беше добро пожелание. Ден след смяна на `CREDIT_PRICE_EUR` човек
 * щеше да вижда едно число тук и друго в Stripe.
 *
 * Сега правилата идват от `GET /api/checkout`, а сметката се прави с ФУНКЦИЯТА
 * НА СЪРВЪРА — `quote` от `@probvai/core/pricing` е чиста аритметика без нито
 * един внос и върви и от двете страни. Една формула, едни числа.
 *
 * ⚠ Показаното пак е само показано. Сумата, срещу която се плаща, се смята
 *   наново на сървъра при създаването на сесията. Промени ли някой този файл
 *   в браузъра си, ще види друга цена на екрана и ще плати истинската.
 */

const RULES_KEY = 'purchase-rules';

export default function KreditiPage() {
  return (
    /**
     * `useSearchParams` спира предварителното рендиране на всичко над себе си.
     * Границата го затваря в най-малкото възможно място, за да не изпадне
     * цялата страница в клиентско рендиране заради едно съобщение след
     * отказано плащане.
     */
    <React.Suspense fallback={<Skeleton />}>
      <Kupuvane />
    </React.Suspense>
  );
}

function Skeleton() {
  return (
    <main className="px-5 pt-6">
      <h1 className="display text-[28px]">Зареди проби</h1>
      <div className="skeleton mt-6 h-[236px] rounded-[var(--radius-card)]" />
      <div className="skeleton mt-5 h-14 rounded-full" />
    </main>
  );
}

/** Първото предложение: два пъти минимума, но не над тавана. */
function suggest(rules: PriceRules): number {
  return Math.min(rules.max, rules.min * 2);
}

/**
 * ═══ ЗАЩО ДВЕТЕ ЧИСЛА СА С `clamp`, А НЕ С ЗАКОВАН РАЗМЕР ═══
 *
 * Докато таванът беше зашит на 200, най-дългото число беше три знака и 46
 * пиксела стояха добре. Щом границите тръгнаха от средата, „1000" се допря до
 * „€200.00", а на телефон от 320 пиксела цената излезе извън картата.
 *
 * Първо ги смалих според дължината на числото. Стана по-добре и пак не
 * стигаше: на тесен екран и по-малкият размер не се събира, защото проблемът
 * не е в броя знаци, а в ширината, с която разполагаме.
 *
 * `clamp` мери точно нея. Долу има под какъв размер не слизаме, горе — таван,
 * за да не порасне числото абсурдно на таблет, а по средата размерът следва
 * екрана.
 *
 * ⚠ И това само по себе си НЕ стигаше. Измерих буквите: заглавният шрифт е
 *   широк — „€200.00" при 24 пиксела заема 136, а картата на телефон от 320
 *   пиксела дава 236 общо. Затова размерът е само половината от решението;
 *   другата е редът да се пренася (виж по-долу). Числата не се застъпват,
 *   защото има КЪДЕ да отидат, а не защото сме познали шрифта.
 */
const CREDITS_SIZE = 'text-[clamp(30px,11vw,46px)]';
const PRICE_SIZE = 'text-[clamp(20px,6.5vw,30px)]';

function Kupuvane() {
  const params = useSearchParams();

  // Правилата се помнят между влизанията — иначе екранът мига със скелет при
  // всяко отваряне, за да покаже същите три числа.
  const cached = readCache<PriceRules>(RULES_KEY);
  const [rules, setRules] = React.useState<PriceRules | null>(cached ?? null);
  const [credits, setCredits] = React.useState(cached ? suggest(cached) : 0);

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;

    void fetch('/api/checkout', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((fresh: PriceRules | null) => {
        if (!alive || !fresh) return;
        writeCache(RULES_KEY, fresh);
        setRules(fresh);
        // Числото се нагласява само ако още не е пипано или е излязло извън
        // новите граници. Иначе смяната на цената би върнала плъзгача назад
        // под пръста на човека.
        setCredits((current) =>
          current === 0
            ? suggest(fresh)
            : Math.min(Math.max(current, fresh.min), fresh.max),
        );
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  // Връщане от Stripe без плащане. Казваме го спокойно — отказът от
  // плащане не е грешка и не бива да звучи като такава.
  const cancelled = params.get('otkazano') === '1';

  /**
   * Пуска плащането.
   *
   * Копчето се заключва за целия път. Двойното натискане тук не струва
   * проба, но прави две сесии в Stripe и обърква справките.
   */
  async function pay(): Promise<void> {
    if (busy || !rules) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ credits }),
      });

      const data = (await response.json()) as
        | { url: string }
        | { error: { message: string } };

      if (!response.ok || !('url' in data)) {
        setError('error' in data ? data.error.message : 'Нещо се обърка. Пробвай пак.');
        setBusy(false);
        return;
      }

      // Тръгваме към Stripe. Не отпускаме копчето — този таб вече напуска.
      window.location.href = data.url;
    } catch {
      setError('Няма връзка. Провери интернета и пробвай пак.');
      setBusy(false);
    }
  }

  if (!rules) return <Skeleton />;

  const priced = quote(credits, rules);
  const total = priced.ok ? priced.quote.amountEur : '—';
  const minEur = quote(rules.min, rules);
  const span = Math.max(1, rules.max - rules.min);
  const progress = ((credits - rules.min) / span) * 100;

  return (
    <main className="px-5 pt-6">
      <h1 className="display text-[28px]">Зареди проби</h1>
      <p className="mt-2 text-[14px] leading-snug text-ink-45">
        Една проба е едно генериране. Не изтичат.
      </p>

      {cancelled && (
        <p className="enter-rise mt-4 rounded-[var(--radius-card)] bg-paper-2 px-4 py-3 text-[13.5px] leading-snug text-ink-70">
          Плащането е прекратено. Не е удържано нищо.
        </p>
      )}

      <Patch material="leather" tilt={-1} className="mt-6 px-6 py-7">
        {/* ═══ ЗАЩО РЕДЪТ СЕ ПРЕНАСЯ ═══

            Двете числа стоят едно до друго, докато има място. Няма ли —
            цената слиза на нов ред, вдясно, вместо да излезе извън картата.

            Първо тук имаше `min-w-0`. То разрешава на кутията да се свие под
            съдържанието си — и точно затова буквите изтичаха навън, вместо
            редът да се пренесе. Махнато е нарочно: кутиите пазят ширината си,
            а `flex-wrap` им дава накъде да отидат.

            Така екранът остава верен и ако утре таванът стане 5000. */}
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-4">
          <div>
            <div className={cn('display leading-none text-lime', CREDITS_SIZE)}>
              {credits}
            </div>
            <div className="mt-1 text-[13px] font-semibold text-white/55">
              {credits === 1 ? 'проба' : 'проби'}
            </div>
            <Underscribble className="mt-1 h-2.5 w-20 text-lime/50" />
          </div>

          {/* `ml-auto` държи цената вдясно и когато е сама на реда си.

              `max-[359px]:w-full` я праща на нов ред на тесните телефони, без
              да чака flex да прецени. Измерих го: при 320 пиксела двете числа
              се разминаваха с един пиксел — тоест се допираха и се четяха като
              „1000€200.00". Един пиксел разлика е същото като нула. */}
          <div className="ml-auto text-right max-[359px]:w-full">
            <div className={cn('display leading-none text-white', PRICE_SIZE)}>
              €{total}
            </div>
            <div className="mt-1.5 text-[12px] text-white/45">
              €{rules.pricePerCredit.toFixed(2)} на проба
            </div>
          </div>
        </div>

        <label className="mt-7 block">
          <span className="sr-only">Брой проби</span>
          <input
            type="range"
            min={rules.min}
            max={rules.max}
            step={rules.step}
            value={credits}
            onChange={(event) => setCredits(Number(event.target.value))}
            className="range w-full"
            style={{ '--progress': `${progress}%` } as React.CSSProperties}
          />
        </label>

        <div className="mt-2 flex justify-between text-[12px] text-white/40">
          <span>{rules.min}</span>
          <span>{rules.max}</span>
        </div>

        {/* Долната и горната граница, изписани с думи. Плъзгач, който просто
            отказва да мине под минимума, изглежда счупен — числото обяснява
            защо спира. */}
        <p className="mt-4 text-[12.5px] leading-snug text-white/45">
          Минимум {rules.min} проби · €{minEur.ok ? minEur.quote.amountEur : '—'}.
          Наведнъж може да заредиш най-много {rules.max}.
        </p>
      </Patch>

      <Button
        variant="action"
        size="lg"
        block
        className="mt-5"
        busy={busy}
        onClick={() => void pay()}
      >
        {busy ? 'Отваряме плащането...' : `Зареди · €${total}`}
      </Button>

      {error ? (
        <p className="enter-rise mt-3 text-center text-[13px] text-danger">{error}</p>
      ) : (
        <p className="mt-3 text-center text-[12.5px] text-ink-45">
          Плащането минава през Stripe. Не пазим данни за карти.
        </p>
      )}

      {/* ── Какво се променя след покупка ───────────────────────────────── */}
      <section className="mt-10 rounded-[var(--radius-card)] bg-violet-wash p-5">
        <div className="text-[15px] font-semibold">Без воден знак</div>
        <p className="mt-1 text-[13.5px] leading-snug text-ink-70">
          След първата покупка всички проби излизат чисти — и старите, и новите.
        </p>
      </section>
    </main>
  );
}
