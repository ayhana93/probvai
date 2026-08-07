'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Patch } from '@/components/ui/patch';
import { Mascot } from '@/components/mascot';
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
 */

const PRICE_EUR = 0.2;
const MIN = 25;
const MAX = 250;
const STEP = 5;

export default function KreditiPage() {
  const [credits, setCredits] = React.useState(50);
  const total = (credits * PRICE_EUR).toFixed(2);
  const progress = ((credits - MIN) / (MAX - MIN)) * 100;

  return (
    <main className="px-5 pt-6">
      <h1 className="display text-[28px]">Зареди кредити</h1>
      <p className="mt-2 text-[14px] leading-snug text-ink-45">
        Един кредит е една проба. Не изтичат.
      </p>

      <Patch material="leather" tilt={-1} className="mt-6 px-6 py-7">
        <div className="flex items-center justify-between">
          <div>
            <div className="display text-[46px] leading-none text-lime">{credits}</div>
            <div className="mt-1 text-[13px] font-semibold text-white/55">кредита</div>
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
          <span className="sr-only">Брой кредити</span>
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
      </Patch>

      <Button variant="action" size="lg" block className="mt-5">
        Зареди · €{total}
      </Button>

      <p className="mt-3 text-center text-[12.5px] text-ink-45">
        Плащането минава през Stripe. Не пазим данни за карти.
      </p>

      {/* ── Какво се променя след покупка ───────────────────────────────── */}
      <section className="mt-10 flex items-center gap-4 rounded-[var(--radius-card)] bg-violet-wash p-4">
        <Mascot credits={credits} size={64} className="shrink-0" />
        <div>
          <div className="text-[15px] font-semibold">Без воден знак</div>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-70">
            След първата покупка всички проби излизат чисти — и старите, и новите.
          </p>
        </div>
      </section>
    </main>
  );
}
