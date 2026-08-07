/**
 * ГЕРОЯТ
 *
 * Тениска-парче, изрязана в езика на логото: тъмно парче, светла форма
 * отвътре — точно както кожената „Б" носи бяла буква.
 *
 * ═══ КРЕДИТИТЕ СА НИВОТО НА МАТЕРИАЛА ═══
 *
 * Празната тениска е само шев върху хартия. С всеки кредит материалът се
 * качва отдолу нагоре. При 25 и повече е пълна. Това е единственият
 * индикатор за баланс, който потребителката вижда, без да чете число.
 *
 * ═══ ЗАЩО ДВИЖЕНИЕТО Е НА CSS, А НЕ НА JAVASCRIPT ═══
 *
 * Всички състояния тук са предварително известни — полюшване, трепване,
 * пулс. CSS анимациите вървят извън главната нишка и остават гладки,
 * докато страницата зарежда. Същото на `requestAnimationFrame` изпуска
 * кадри точно тогава, когато най-си личи.
 *
 * Пружини се ползват за жестове, които могат да бъдат прекъснати. Тук
 * такива няма.
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

export type MascotState = 'idle' | 'generating' | 'success' | 'error';

export type MascotProps = {
  credits: number;
  state?: MascotState;
  daysSinceLastUse?: number;
  size?: number;
  className?: string;
};

/** Изражението се избира по състояние, не по вкус. */
type Face = 'happy' | 'neutral' | 'sad' | 'sulky' | 'asleep' | 'thrilled';

/** Пълна тениска при толкова кредита. */
const FULL_AT = 25;

const TEE =
  'M48 26 Q60 37 72 26 Q86 29 98 39 L110 60 L92 70 L87 63 L87 100 L33 100 L33 63 L28 70 L10 60 L22 39 Q34 29 48 26 Z';

function pickFace(credits: number, state: MascotState, days: number): Face {
  if (state === 'generating') return 'asleep';
  if (state === 'success') return 'thrilled';
  if (state === 'error') return 'sad';
  if (credits === 0) return 'sad';
  if (days > 7) return 'sulky';
  if (credits < 5) return 'neutral';
  return 'happy';
}

function pickMotion(credits: number, state: MascotState, days: number): string {
  if (state === 'generating') return 'mascot-work';
  if (state === 'success') return 'mascot-hop';
  if (credits === 0) return 'mascot-droop';
  if (days > 7) return 'mascot-tap';
  if (credits < 5) return 'mascot-twitch';
  return 'mascot-sway';
}

function Eyes({ face }: { face: Face }) {
  const ink = 'var(--color-ink)';

  if (face === 'asleep') {
    return (
      <g stroke={ink} strokeWidth="4" strokeLinecap="round" fill="none">
        <path d="M44 76 Q49 80 54 76" />
        <path d="M66 76 Q71 80 76 76" />
      </g>
    );
  }
  if (face === 'happy' || face === 'thrilled') {
    // Полумесеци нагоре — усмихнати очи.
    return (
      <g stroke={ink} strokeWidth="4.5" strokeLinecap="round" fill="none">
        <path d="M44 78 Q49 72 54 78" />
        <path d="M66 78 Q71 72 76 78" />
      </g>
    );
  }
  if (face === 'sulky') {
    // Присвити — тесни хоризонтални цепки.
    return (
      <g stroke={ink} strokeWidth="4.5" strokeLinecap="round">
        <path d="M44 77 L54 77" />
        <path d="M66 77 L76 77" />
      </g>
    );
  }
  if (face === 'sad') {
    // Гледа надолу: зеницата е ниско в окото.
    return (
      <g fill={ink}>
        <circle cx="49" cy="79" r="4" />
        <circle cx="71" cy="79" r="4" />
      </g>
    );
  }
  return (
    <g fill={ink}>
      <circle cx="49" cy="77" r="4.2" />
      <circle cx="71" cy="77" r="4.2" />
    </g>
  );
}

function Mouth({ face }: { face: Face }) {
  const ink = 'var(--color-ink)';
  const base = { stroke: ink, strokeWidth: 4.5, strokeLinecap: 'round' as const, fill: 'none' };

  switch (face) {
    case 'thrilled':
      return <path d="M50 86 Q60 98 70 86 Q60 92 50 86 Z" fill={ink} />;
    case 'happy':
      return <path d="M52 87 Q60 94 68 87" {...base} />;
    case 'neutral':
      return <path d="M53 89 L67 89" {...base} />;
    case 'sulky':
      return <path d="M53 91 Q60 87 67 91" {...base} />;
    case 'asleep':
      return <path d="M55 89 Q60 92 65 89" {...base} />;
    case 'sad':
    default:
      return <path d="M52 92 Q60 84 68 92" {...base} />;
  }
}

function Confetti() {
  const bits = [
    { x: 18, y: 30, c: 'var(--color-lime)', d: 0 },
    { x: 100, y: 34, c: 'var(--color-violet)', d: 60 },
    { x: 30, y: 92, c: 'var(--color-orange)', d: 120 },
    { x: 96, y: 88, c: 'var(--color-denim)', d: 40 },
    { x: 60, y: 16, c: 'var(--color-violet-soft)', d: 90 },
  ];
  return (
    <g aria-hidden="true">
      {bits.map((bit, i) => (
        <rect
          key={i}
          x={bit.x}
          y={bit.y}
          width="6"
          height="9"
          rx="1.5"
          fill={bit.c}
          className="mascot-confetti"
          style={{ animationDelay: `${bit.d}ms`, transformOrigin: `${bit.x + 3}px ${bit.y + 4}px` }}
        />
      ))}
    </g>
  );
}

export function Mascot({
  credits,
  state = 'idle',
  daysSinceLastUse = 0,
  size = 72,
  className,
}: MascotProps) {
  const id = React.useId();
  const level = Math.min(1, Math.max(0, credits / FULL_AT));

  // Силуетът заема от y=26 до y=100. Материалът се качва в тези граници.
  const top = 26;
  const bottom = 100;
  const fillTop = bottom - (bottom - top) * level;

  const face = pickFace(credits, state, daysSinceLastUse);
  const motion = pickMotion(credits, state, daysSinceLastUse);

  const label =
    state === 'generating'
      ? 'Пробата се прави'
      : state === 'success'
        ? 'Готово'
        : credits === 0
          ? 'Нямаш кредити'
          : `${credits} ${credits === 1 ? 'кредит' : 'кредита'}`;

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role="img"
      aria-label={label}
      className={cn(motion, className)}
    >
      <defs>
        <clipPath id={`tee-${id}`}>
          <path d={TEE} />
        </clipPath>
        <linearGradient id={`fill-${id}`} x1="0" y1="1" x2="0.35" y2="0">
          <stop offset="0%" stopColor="var(--color-lime-deep)" />
          <stop offset="100%" stopColor="var(--color-lime)" />
        </linearGradient>
      </defs>

      {state === 'success' && <Confetti />}

      {/* Празната тениска: хартия със шев. */}
      <path d={TEE} fill="var(--color-paper)" />

      {/* Материалът, качен до нивото на кредитите.
          Горният ръб е леко вълнист — права линия изглежда като сложена
          отгоре кутия, вълната изглежда като нещо, което се е наляло. */}
      {level > 0 && (
        <g clipPath={`url(#tee-${id})`}>
          <path
            d={`M0 ${fillTop} Q30 ${fillTop - 3.5} 60 ${fillTop} T120 ${fillTop} L120 104 L0 104 Z`}
            fill={`url(#fill-${id})`}
            className="mascot-fill"
          />
        </g>
      )}

      {/* Контурът е последен, за да е чист над материала. */}
      <path
        d={TEE}
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth="5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      <g className="mascot-face">
        <Eyes face={face} />
        <Mouth face={face} />
      </g>
    </svg>
  );
}
