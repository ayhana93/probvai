/**
 * ТАБОВЕ С ИЗРЯЗВАНЕ
 *
 * Обикновеният начин е да се анимира цветът на текста при смяна на таб.
 * Той никога не изглежда добре: за миг се виждат два полутона и надписът
 * „минава" през сиво.
 *
 * Тук списъкът е нарисуван ДВА ПЪТИ. Долният е в спокойния вид, горният е
 * изцяло в активния вид, а `clip-path` показва от него само активния таб.
 * Анимира се изрязването, не цветът — така преходът е идеален по
 * определение, защото цвят изобщо не се сменя.
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

type Props<T extends string> = {
  tabs: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

export function Tabs<T extends string>({ tabs, value, onChange, className }: Props<T>) {
  const index = Math.max(
    0,
    tabs.findIndex((tab) => tab.value === value),
  );
  const width = 100 / tabs.length;
  const left = index * width;
  const right = 100 - left - width;

  const row = (active: boolean) => (
    <div className="flex" aria-hidden={active || undefined}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={tab.value === value}
          tabIndex={active ? -1 : 0}
          onClick={() => onChange(tab.value)}
          className={cn(
            'h-11 flex-1 select-none rounded-full text-[15px] font-semibold',
            'transition-transform duration-[var(--dur-press)] ease-[var(--ease-out)]',
            'active:scale-[0.98]',
            active ? 'text-paper' : 'text-ink-45',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className={cn('relative rounded-full bg-paper-2 p-1', className)} role="tablist">
      {row(false)}

      {/* Копието в активния вид. Вижда се само през прозореца на clip-path. */}
      <div
        className="pointer-events-none absolute inset-1 rounded-full bg-ink transition-[clip-path] duration-[var(--dur-menu)] ease-[var(--ease-in-out)]"
        style={{ clipPath: `inset(0 ${right}% 0 ${left}% round 999px)` }}
      >
        {row(true)}
      </div>
    </div>
  );
}
