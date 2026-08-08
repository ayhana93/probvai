'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ResultView } from '@/components/result-view';
import { WaitCards } from '@/components/wait-cards';
import { Button } from '@/components/ui/button';
import { Patch } from '@/components/ui/patch';
import { Sparks } from '@/components/ui/scribble';
import { useGeneration } from '@/lib/use-generation';
import { useMe } from '@/lib/use-me';
import { isStyleKey } from '@/lib/styles';

/**
 * ЕДНА ПРОБА: от чакане до резултат
 *
 * Отделен адрес, а не състояние в предишния екран. Така пробата може да
 * се презареди, да се остави и да се отвори пак — а телефон, който заспива
 * по средата, не я губи.
 */

/**
 * Какво пише, докато се чака.
 *
 * ═══ ЗАЩО НЯМА ЛЕНТА С ПРОЦЕНТИ ═══
 *
 * Не знаем колко процента е готово — доставчикът не ни го казва. Лента,
 * която пълзи до 90% и там спира, е лъжа и всеки я разпознава.
 *
 * Затова: истинският брояч на секундите и текст, който се мени. Текстът
 * казва точно това, което човек иска да знае на тази секунда.
 */
const WAITING: { after: number; text: string }[] = [
  { after: 0, text: 'Обикновено отнема около 30 секунди.' },
  { after: 20, text: 'Още малко. Пробваме как пада плата.' },
  { after: 45, text: 'Тази е от по-бавните. Стой още малко.' },
  { after: 70, text: 'Ако не стане до минута и половина, кредитът се връща.' },
];

function waitingText(elapsed: number): string {
  let text = WAITING[0]!.text;
  for (const step of WAITING) {
    if (elapsed >= step.after) text = step.text;
  }
  return text;
}

export default function ProbaResultPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const { view, elapsed, timedOut, done } = useGeneration(id);
  const { me } = useMe();

  // ── Готово ──────────────────────────────────────────────────────────────
  if (view?.status === 'DONE' && view.resultUrl) {
    return (
      <ResultView
        generationId={id}
        resultUrl={view.resultUrl}
        watermarked={view.watermarked}
        merchant={view.merchant}
        category={isStyleKey(view.category) ? view.category : null}
        saved={view.saved}
        published={view.published}
        canPublish={me?.profile.wardrobePublic ?? false}
        recommendations={view.recommendations}
        onRetry={() => router.push('/proba')}
      />
    );
  }

  // ── Не се получи ────────────────────────────────────────────────────────
  if (done || timedOut) {
    const message =
      view?.errorMessage ??
      'Отне прекалено дълго. Кредитът ти е върнат — пробвай пак.';

    return (
      <main className="flex min-h-[78dvh] flex-col items-center justify-center px-8 text-center">
        <Patch material="felt" tilt={-2} className="mb-6 px-4 py-3">
          <span className="display text-[15px]">не се получи</span>
        </Patch>

        <p className="max-w-[280px] text-[15px] leading-snug text-ink-70">{message}</p>

        <div className="mt-7 flex w-full max-w-[280px] flex-col gap-2.5">
          <Button variant="action" size="lg" block onClick={() => router.push('/proba')}>
            Пробвай пак
          </Button>
          <Link
            href="/"
            className="pressable flex h-11 items-center justify-center text-[14px] font-semibold text-ink-45"
          >
            Към началото
          </Link>
        </div>
      </main>
    );
  }

  // ── Чакане ──────────────────────────────────────────────────────────────
  return (
    <main className="px-5 pt-8">
      <div className="flex items-center gap-2">
        <h1 className="display text-[26px]">Правим я</h1>
        <Sparks className="mb-1.5 h-3.5 w-6 text-violet" />
      </div>

      {/* Скелетът показва КАКВО идва — правоъгълникът е точно с формата на
          бъдещия резултат. Въртящо кръгче не казва нищо. */}
      <div className="skeleton mt-5 aspect-[3/4] w-full rounded-[var(--radius-card)]" />

      <div className="mt-6 flex items-baseline justify-between">
        <span className="text-[14px] text-ink-45">{waitingText(elapsed)}</span>
        <span
          className="display text-[22px] tabular-nums text-ink"
          aria-label={`Изминали ${elapsed} секунди`}
        >
          {elapsed}s
        </span>
      </div>

      <p className="mt-4 text-[13px] leading-snug text-ink-25">
        Може да излезеш от този екран. Пробата ще те чака в гардероба.
      </p>

      <WaitCards cards={view?.waiting ?? []} />
    </main>
  );
}
