'use client';

import * as React from 'react';
import Link from 'next/link';
import { Patch } from '@/components/ui/patch';
import { Sparks } from '@/components/ui/scribble';
import { R } from '@/lib/routes';

/**
 * СЛЕД ПЛАЩАНЕ
 *
 * ═══ ТОЗИ ЕКРАН НЕ НАЧИСЛЯВА НИЩО ═══
 *
 * Той е обикновено пренасочване в браузъра — всеки може да го отвори на
 * ръка. Кредитите влизат само от webhook-а, подписан от Stripe.
 *
 * Затова тук не пише „Готово". Тук се ЧАКА: питаме баланса на всеки две
 * секунди, докато не се промени. Обикновено webhook-ът пристига преди
 * човекът да е дочел първия ред.
 *
 * Ако не пристигне до половин минута, не лъжем и не показваме грешка —
 * казваме истината: плащането е прието, кредитите идват. Всяко друго
 * съобщение би било или невярно, или излишна тревога.
 */

const POLL_MS = 2000;
const GIVE_UP_MS = 30_000;

type Phase = 'waiting' | 'done' | 'slow';

export default function UspehPage() {
  const [phase, setPhase] = React.useState<Phase>('waiting');
  const [credits, setCredits] = React.useState<number | null>(null);

  React.useEffect(() => {
    let stopped = false;
    // Балансът отпреди плащането. Първата разлика значи, че webhook-ът е
    // минал — не сравняваме с очаквано число, защото не му вярваме.
    let baseline: number | null = null;
    const startedAt = Date.now();

    async function tick(): Promise<void> {
      if (stopped) return;

      try {
        const response = await fetch('/api/me', { cache: 'no-store' });
        if (response.ok) {
          const me = (await response.json()) as { credits: number };
          if (baseline === null) {
            baseline = me.credits;
          } else if (me.credits > baseline) {
            setCredits(me.credits);
            setPhase('done');
            return;
          }
          setCredits(me.credits);
        }
      } catch {
        // Мрежата може да мигне. Следващият опит идва след две секунди.
      }

      if (stopped) return;
      if (Date.now() - startedAt > GIVE_UP_MS) {
        setPhase('slow');
        return;
      }
      window.setTimeout(() => void tick(), POLL_MS);
    }

    void tick();
    return () => {
      stopped = true;
    };
  }, []);

  return (
    <main className="flex min-h-[78dvh] flex-col items-center justify-center px-8 text-center">
      <div className="relative">
        <Patch
          material={phase === 'done' ? 'knit' : 'paper'}
          tilt={-2}
          className="grid size-24 place-items-center"
        >
          {phase === 'done' ? (
            <svg
              viewBox="0 0 24 24"
              className="enter-pop size-11 text-ink"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 12.5l5 5L20 6.5" />
            </svg>
          ) : (
            <div className="skeleton size-11 rounded-full" />
          )}
        </Patch>
        {phase === 'done' && (
          <Sparks className="absolute -right-6 -top-4 h-6 w-10 text-violet" />
        )}
      </div>

      {phase === 'done' ? (
        <>
          <h1 className="display mt-7 text-[26px]">Пробите са в теб</h1>
          <p className="mt-2 text-[14px] leading-snug text-ink-45">
            Балансът ти е {credits} {credits === 1 ? 'проба' : 'проби'}. От
            сега нататък пробите излизат без воден знак.
          </p>
        </>
      ) : phase === 'slow' ? (
        <>
          <h1 className="display mt-7 text-[26px]">Плащането е прието</h1>
          <p className="mt-2 max-w-[280px] text-[14px] leading-snug text-ink-45">
            Пробите се зареждат. Понякога банката потвърждава с минута
            закъснение — влез пак след малко и ще са там.
          </p>
        </>
      ) : (
        <>
          <h1 className="display mt-7 text-[26px]">Един момент</h1>
          <p className="mt-2 max-w-[280px] text-[14px] leading-snug text-ink-45">
            Чакаме потвърждение от банката. Не затваряй екрана.
          </p>
        </>
      )}

      <Link
        href={phase === 'done' ? R.tryOn : R.home}
        className="pressable mt-7 inline-flex items-center rounded-full bg-lime px-7 py-3.5 shadow-[0_3px_0_var(--color-lime-deep)]"
      >
        <span className="display text-[16px]">
          {phase === 'done' ? 'Пробвай нещо' : 'Към началото'}
        </span>
      </Link>
    </main>
  );
}
