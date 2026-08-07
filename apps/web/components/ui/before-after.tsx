/**
 * ПЛЪЗГАЧ ПРЕДИ / СЛЕД
 *
 * ═══ ЗАЩО ДОЛУ ИМА СКРИТ `input type=range` ═══
 *
 * Изкушението е да се направи с `onPointerDown` върху `<div>`. Работи с
 * мишка и с пръст — и спира дотам. Нативният плъзгач носи наготово:
 * стрелките на клавиатурата, Home и End, четенето от екранен четец,
 * влаченето с пръст без да гони пиксели, и правилното поведение, когато
 * пръстът излезе извън елемента.
 *
 * Затова той е тук, прозрачен, върху цялата снимка. Видимото е рисувано
 * от нас; поведението е на системата.
 *
 * ═══ ЗАЩО `clip-path`, А НЕ ШИРОЧИНА ═══
 *
 * Смяната на `width` кара браузъра да преизчислява разположение и да
 * прерисува при всеки кадър на влаченето. `clip-path` само реже вече
 * нарисуваното — върви на видеокартата и не изпуска кадри.
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

type Props = {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
};

export function BeforeAfter({
  beforeSrc,
  afterSrc,
  beforeLabel = 'Преди',
  afterLabel = 'След',
  className,
}: Props) {
  const [position, setPosition] = React.useState(52);
  const [dragging, setDragging] = React.useState(false);

  return (
    <div
      className={cn(
        'relative select-none overflow-hidden rounded-[var(--radius-card)] bg-paper-2',
        className,
      )}
    >
      {/* Долният слой: резултатът. Той е наградата — стои цял отдолу. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={afterSrc}
        alt=""
        draggable={false}
        className="block size-full object-cover"
      />

      {/* Горният слой: оригиналната снимка, отрязана до дръжката. */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeSrc}
          alt=""
          draggable={false}
          className="block size-full object-cover"
        />
      </div>

      {/* Надписите. Този на „преди" се скрива, щом дръжката мине над него —
          иначе виси върху резултата и обърква. */}
      <span
        className={cn(
          'pointer-events-none absolute left-3 top-3 rounded-full bg-ink/75 px-2.5 py-1',
          'text-[11px] font-semibold text-paper backdrop-blur-sm',
          'transition-opacity duration-[var(--dur-tip)] ease-[var(--ease-out)]',
          position < 22 ? 'opacity-0' : 'opacity-100',
        )}
      >
        {beforeLabel}
      </span>
      <span
        className={cn(
          'pointer-events-none absolute right-3 top-3 rounded-full bg-lime px-2.5 py-1',
          'text-[11px] font-semibold text-ink',
          'transition-opacity duration-[var(--dur-tip)] ease-[var(--ease-out)]',
          position > 78 ? 'opacity-0' : 'opacity-100',
        )}
      >
        {afterLabel}
      </span>

      {/* Дръжката. `pointer-events-none`, защото натискането го поема
          скритият плъзгач отдолу — иначе двата се борят за пръста. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0"
        style={{ left: `${position}%` }}
      >
        <div className="absolute inset-y-0 -left-px w-0.5 bg-paper shadow-[0_0_8px_rgba(0,0,0,.45)]" />
        <div
          className={cn(
            'absolute top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center',
            'rounded-full border-[3px] border-ink bg-lime',
            'shadow-[0_2px_10px_-2px_rgba(0,0,0,.55)]',
            'transition-transform duration-[var(--dur-press)] ease-[var(--ease-out)]',
            dragging && 'scale-110',
          )}
        >
          <svg viewBox="0 0 24 24" className="size-5 text-ink" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.5 8 6 12l3.5 4M14.5 8l3.5 4-3.5 4" />
          </svg>
        </div>
      </div>

      <label className="absolute inset-0 cursor-ew-resize">
        <span className="sr-only">Плъзни, за да сравниш преди и след</span>
        <input
          type="range"
          min={0}
          max={100}
          step={0.5}
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          onPointerDown={() => setDragging(true)}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          onBlur={() => setDragging(false)}
          className="size-full cursor-ew-resize opacity-0"
        />
      </label>
    </div>
  );
}
