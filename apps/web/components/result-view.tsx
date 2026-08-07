/**
 * РЕЗУЛТАТЪТ
 *
 * Наградата. Единственият екран, на който снимката е по-важна от всичко
 * останало — затова тя заема каквото ѝ трябва, а копчетата се свиват.
 *
 * ═══ ПОДРЕДБАТА НА КОПЧЕТАТА НЕ Е ПО АЗБУЧЕН РЕД ═══
 *
 *   Сподели   — първо и най-широко. Споделянето е основният ни канал за
 *               растеж; ако е трето отдясно, никой няма да го намери.
 *   Запази    — второто по честота.
 *   Купи я    — печели пари, но само когато дрехата е дошла от магазин.
 *               Няма ли магазин, копчето не съществува, вместо да стои
 *               сиво и да пита „защо".
 *   Опитай пак — харчи кредит, затова цената е ИЗПИСАНА на самото копче.
 *               Копче, което взима пари без да предупреди, се натиска
 *               веднъж и после потребителката спира да вярва.
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { BeforeAfter } from '@/components/ui/before-after';
import { Button } from '@/components/ui/button';
import { BagIcon, RetryIcon, SaveIcon, ShareIcon } from '@/components/ui/icons';
import { Sparks } from '@/components/ui/scribble';
import { cn } from '@/lib/cn';

export type ResultViewProps = {
  generationId: string;
  personUrl: string;
  resultUrl: string;
  watermarked: boolean;
  merchant?: string | null;
  buyUrl?: string | null;
  onRetry?: () => void;
};

type ShareState = 'idle' | 'working' | 'saved' | 'failed';

export function ResultView({
  generationId,
  personUrl,
  resultUrl,
  watermarked,
  merchant,
  buyUrl,
  onRetry,
}: ResultViewProps) {
  const [share, setShare] = React.useState<ShareState>('idle');

  /**
   * Споделяне: първо Web Share API с файла, после сваляне.
   *
   * Проверката е `canShare({ files })`, не `share` — Android има `share`,
   * но не всеки браузър приема файлове. Без тази проверка потребителката
   * вижда грешка вместо картинка.
   */
  const onShare = React.useCallback(async () => {
    setShare('working');
    try {
      const response = await fetch(`/api/generate/${generationId}/share`);
      if (!response.ok) throw new Error('няма готова картинка');

      const blob = await response.blob();
      const file = new File([blob], `probvai-${generationId}.jpg`, { type: 'image/jpeg' });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'ПРОБВАЙ' });
        setShare('idle');
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
      setShare('saved');
    } catch {
      setShare('failed');
    }
  }, [generationId]);

  return (
    <main className="flex min-h-dvh flex-col px-4 pb-6 pt-4">
      <div className="enter-pop flex-1">
        <BeforeAfter
          beforeSrc={personUrl}
          afterSrc={resultUrl}
          className="aspect-[3/4] w-full"
        />
      </div>

      {/* ── Водният знак ────────────────────────────────────────────────────
          Не се извинява и не обяснява защо го има. Казва какво се печели
          и води на едно натискане разстояние от касата. */}
      {watermarked && (
        <Link
          href="/krediti"
          className="pressable mt-3 flex items-center justify-between rounded-[var(--radius-card)] bg-violet-wash px-4 py-3.5"
        >
          <span className="flex items-center gap-2">
            <Sparks className="h-4 w-6 text-violet" />
            <span className="text-[14px] font-semibold">Махни водния знак</span>
          </span>
          <span className="text-[13px] text-ink-45">Зареди кредити ›</span>
        </Link>
      )}

      {/* ── Действията ──────────────────────────────────────────────────── */}
      <div className="mt-4 space-y-2.5">
        <div className="flex gap-2.5">
          <Button
            variant="action"
            size="lg"
            block
            busy={share === 'working'}
            onClick={() => void onShare()}
          >
            <ShareIcon />
            {share === 'working' ? 'Готви се...' : 'Сподели'}
          </Button>

          <a
            href={resultUrl}
            download={`probvai-${generationId}.jpg`}
            aria-label="Запази снимката"
            className="pressable grid size-14 shrink-0 place-items-center rounded-full bg-paper-2 text-ink-70"
          >
            <SaveIcon />
          </a>
        </div>

        {share === 'saved' && (
          <p className="enter-rise text-center text-[13px] text-ink-45">
            Свалена е в телефона ти.
          </p>
        )}
        {share === 'failed' && (
          <p className="enter-rise text-center text-[13px] text-danger">
            Не се получи. Пробвай пак след малко.
          </p>
        )}

        <div className={cn('flex gap-2.5', !buyUrl && 'justify-stretch')}>
          {buyUrl && (
            <a
              href={buyUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="pressable flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-paper"
            >
              <BagIcon />
              Купи я{merchant ? ` от ${merchant}` : ''}
            </a>
          )}

          <Button variant="quiet" block={!buyUrl} onClick={onRetry} className="flex-1">
            <RetryIcon />
            Опитай пак · 1 кредит
          </Button>
        </div>
      </div>
    </main>
  );
}
