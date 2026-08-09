'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Patch } from '@/components/ui/patch';
import { Underscribble } from '@/components/ui/scribble';

/**
 * КРЕДИТИ
 *
 * Един плъзгач, едно число, едно копче. Няма планове, няма таблици, няма
 * „най-популярен избор".
 *
 * Плъзгачът е нативен `<input type=range>` нарочно: върви на системата,
 * работи с клавиатура и с екранен четец без нито ред допълнителен код,
 * и не изпуска кадри при влачене.
 *
 * ⚠ Числата тук са само за показване. Сумата, срещу която се плаща, се
 *   смята на сървъра в `packages/core/src/payments.ts`. Ако някой промени
 *   този файл в браузъра си, ще види друга цена на екрана и ще плати
 *   истинската.
 */

const PRICE_EUR = 0.2;
const MIN = 25;
const MAX = 200;
const STEP = 5;

const MIN_EUR = (MIN * PRICE_EUR).toFixed(2);

/**
 * `useSearchParams` спира предварителното рендиране на всичко над себе си.
 * Границата го затваря в най-малкото възможно място, за да не изпадне цялата
 * страница в клиентско рендиране заради едно съобщение след отказано плащане.
 */
export default function KreditiPage() {
  return (
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

function Kupuvane() {
  const params = useSearchParams();
  const [credits, setCredits] = React.useState(50);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const total = (credits * PRICE_EUR).toFixed(2);
  const progress = ((credits - MIN) / (MAX - MIN)) * 100;

  // Връщане от Stripe без плащане. Казваме го спокойно — отказът от
  // плащане не е грешка и не бива да звучи като такава.
  const cancelled = params.get('otkazano') === '1';

  /**
   * Пуска плащането.
   *
   * Копчето се заключва за целия път. Двойното натискане тук не струва
   * кредит, но прави две сесии в Stripe и обърква справките.
   */
  async function pay(): Promise<void> {
    if (busy) return;
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
        <div className="flex items-center justify-between">
          <div>
            <div className="display text-[46px] leading-none text-lime">{credits}</div>
            <div className="mt-1 text-[13px] font-semibold text-white/55">проби</div>
            <Underscribble className="mt-1 h-2.5 w-20 text-lime/50" />
          </div>

          <div className="text-right">
            <div className="display text-[32px] leading-none text-white">€{total}</div>
            <div className="mt-1.5 text-[12px] text-white/45">
              €{PRICE_EUR.toFixed(2)} на проба
            </div>
          </div>
        </div>

        <label className="mt-7 block">
          <span className="sr-only">Брой проби</span>
          <input
            type="range"
            min={MIN}
            max={MAX}
            step={STEP}
            value={credits}
            onChange={(event) => setCredits(Number(event.target.value))}
            className="range w-full"
            style={{ '--progress': `${progress}%` } as React.CSSProperties}
          />
        </label>

        <div className="mt-2 flex justify-between text-[12px] text-white/40">
          <span>{MIN}</span>
          <span>{MAX}</span>
        </div>

        {/* Долната и горната граница, изписани с думи. Плъзгач, който
            просто отказва да мине под 25, изглежда счупен — числото
            обяснява защо спира. */}
        <p className="mt-4 text-[12.5px] leading-snug text-white/45">
          Минимум {MIN} проби · €{MIN_EUR}. Наведнъж може да заредиш най-много{' '}
          {MAX}.
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
