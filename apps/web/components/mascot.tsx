/**
 * ГЕРОЯТ
 *
 * Рисунките са твои — стоят в `apps/web/public/mascot/`. Кодът тук решава
 * само едно: КОЯ рисунка се показва в кой момент.
 *
 * ═══ КОЯ ЕМОЦИЯ ПРИ КОЛКО КРЕДИТА ═══
 *
 *   0        празен      сив, умърлушен
 *   1–4      малко       блед, спокоен
 *   5–14     доволен     лайм, усмихнат
 *   15+      пълен       лайм, широка усмивка, шапка с каре и искри
 *
 * Прагът 15 не е случаен. Безплатните кредити стигат най-много до 5
 * (3 + имейл + телефон), а най-малката покупка е 25. Значи над 15 стига
 * САМО човек, който е платил — и празничното лице е негово.
 *
 * Състоянията от работата бият над кредитите: докато тече генерация,
 * няма значение колко кредита има.
 *
 * ═══ ЗА АНИМАЦИЯТА ═══
 *
 * Рисунката е плоска картинка — очите в нея не могат да се движат. Затова
 * животът идва от формата: тихо носене нагоре-надолу и кратко „сплескване"
 * на всеки няколко секунди. В езика на анимацията сплескването се чете
 * като мигване, а не като трепване.
 *
 * Всичко е на CSS: върви извън главната нишка и не пада кадри, докато
 * страницата зарежда.
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';
import { useImageStatus } from '@/lib/use-image-status';

export type MascotState = 'idle' | 'generating' | 'success' | 'error';

export type MascotMood =
  | 'empty'
  | 'low'
  | 'happy'
  | 'full'
  | 'stale'
  | 'working'
  | 'done'
  | 'failed';

/** Праговете. Едно място, лесни за въртене. */
export const MOOD_THRESHOLDS = {
  /** Под това е „малко". */
  happy: 5,
  /** Над това е „пълен" — стига се само с покупка. */
  full: 15,
  /** След толкова дни без употреба героят се цупи. */
  staleDays: 7,
} as const;

const LABELS: Record<MascotMood, string> = {
  empty: 'Нямаш кредити',
  low: 'Остават ти малко кредити',
  happy: 'Имаш кредити',
  full: 'Имаш много кредити',
  stale: 'Отдавна не си пробвала нищо',
  working: 'Пробата се прави',
  done: 'Готово',
  failed: 'Не се получи',
};

/** Как се движи всяко настроение. */
const MOTION: Record<MascotMood, string> = {
  empty: 'mascot-still',
  low: 'mascot-float-slow',
  happy: 'mascot-float',
  full: 'mascot-float',
  stale: 'mascot-tap',
  working: 'mascot-work',
  done: 'mascot-hop',
  failed: 'mascot-still',
};

/** Кои настроения мигат. „Работи" вече е със затворени очи. */
const BLINKS = new Set<MascotMood>(['low', 'happy', 'full', 'stale']);

export function moodFor(
  credits: number,
  state: MascotState = 'idle',
  daysSinceLastUse = 0,
): MascotMood {
  if (state === 'generating') return 'working';
  if (state === 'success') return 'done';
  if (state === 'error') return 'failed';

  if (credits <= 0) return 'empty';
  if (daysSinceLastUse > MOOD_THRESHOLDS.staleDays) return 'stale';
  if (credits < MOOD_THRESHOLDS.happy) return 'low';
  if (credits < MOOD_THRESHOLDS.full) return 'happy';
  return 'full';
}

export type MascotProps = {
  credits?: number;
  state?: MascotState;
  daysSinceLastUse?: number;
  /** Прескача пресмятането по кредити. Ползва се в демото. */
  mood?: MascotMood;
  size?: number;
  /** Горе на екрана — казва на браузъра да я тегли първа. */
  eager?: boolean;
  className?: string;
};

export function Mascot({
  credits = 0,
  state = 'idle',
  daysSinceLastUse = 0,
  mood: forced,
  size = 72,
  eager,
  className,
}: MascotProps) {
  const image = useImageStatus();
  const mood = forced ?? moodFor(credits, state, daysSinceLastUse);

  // Докато рисунките ги няма, показваме нарочно заместващо петно, а не
  // счупена картинка. Така екранът изглежда недовършен, не развален.
  if (image.failed) {
    return (
      <span
        role="img"
        aria-label={LABELS[mood]}
        title={`Липсва /mascot/${mood}.png`}
        style={{ width: size, height: size }}
        className={cn(
          'grid shrink-0 place-items-center rounded-full',
          'border-2 border-dashed border-ink-25 bg-paper-2 text-ink-25',
          className,
        )}
      >
        <span className="text-[9px] font-semibold uppercase leading-none tracking-wide">
          {mood}
        </span>
      </span>
    );
  }

  return (
    <span
      style={{ width: size, height: size }}
      className={cn('block shrink-0', MOTION[mood], className)}
    >
      <span className={cn('block size-full', BLINKS.has(mood) && 'mascot-blink')}>
        {/* Обикновен <img>, не next/image: рисунките са малки и статични,
            а тук ни трябва `onError`, за да покажем заместващото петно. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={image.ref}
          src={`/mascot/${mood}.png`}
          alt={LABELS[mood]}
          width={size}
          height={size}
          draggable={false}
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : 'auto'}
          onError={image.onError}
          className="size-full select-none object-contain"
        />
      </span>
    </span>
  );
}

/**
 * ГЕРОЯТ КАТО КОПЧЕ
 *
 * Големият бутон за нова проба. Няма правоъгълник около него — самата
 * фигура е копчето.
 *
 * Затова тук има повече грижа, отколкото за обикновено копче:
 *   • областта за натискане е кръгла и стига до ръба на фигурата
 *   • при натискане се свива на 0.94 — по-силно от обикновено копче,
 *     защото меката фигура трябва да отговори меко
 *   • изключеното състояние НЕ е избледняване, а смяна на изражението:
 *     героят не може да работи и го показва с лицето си
 */
export function MascotButton({
  credits,
  state = 'idle',
  daysSinceLastUse = 0,
  disabled,
  size = 148,
  label,
  hint,
  onClick,
  className,
}: {
  credits: number;
  state?: MascotState;
  daysSinceLastUse?: number;
  disabled?: boolean;
  size?: number;
  label: string;
  hint?: string;
  onClick?: () => void;
  className?: string;
}) {
  const mood = disabled && state === 'idle' ? 'empty' : moodFor(credits, state, daysSinceLastUse);
  const busy = state === 'generating';

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        className={cn(
          'group relative grid place-items-center rounded-full',
          'transition-transform duration-[var(--dur-press)] ease-[var(--ease-out)]',
          'active:scale-[0.94] disabled:cursor-not-allowed',
        )}
        style={{ width: size, height: size }}
      >
        {/* Мекото петно отдолу: фигурата стои върху нещо, не виси. */}
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-0 rounded-full transition-opacity duration-[var(--dur-menu)] ease-[var(--ease-out)]',
            disabled ? 'bg-paper-2 opacity-70' : 'bg-lime/25',
          )}
        />
        <Mascot mood={mood} size={size} eager className="relative" />
      </button>

      <span className="display mt-3 text-[17px]">{label}</span>
      {hint && <span className="mt-1 text-[13px] text-ink-45">{hint}</span>}
    </div>
  );
}
