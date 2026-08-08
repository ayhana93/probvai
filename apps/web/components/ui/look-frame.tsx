/**
 * РАМКАТА НА ВИЗИЯТА
 *
 * Готовата снимка не се показва гола. Тя изкача в рамка от езика на логото:
 * парче материал отдолу, снимката залепена отгоре леко накриво, дебел
 * тъмен кант.
 *
 * ═══ ЗАЩО РАМКА, А НЕ ПРОСТО СНИМКА ═══
 *
 * Резултатът от AI изглежда като файл. Същият файл в рамка изглежда като
 * нещо направено — и се споделя. Рамката е и подписът ни: където и да
 * отиде снимката, се вижда откъде идва, без да пишем нищо върху нея.
 *
 * ═══ ЗАЩО ИЗКАЧА ═══
 *
 * Появата е `scale(0.92) → 1` за 320 мс с нашата крива. Достатъчно, за да
 * се усети като награда; недостатъчно, за да се чака. Изключи ли човек
 * анимациите в системата си, снимката просто се появява — това е в
 * `prefers-reduced-motion` блока на globals.css.
 */

'use client';

import * as React from 'react';
import { Patch, type Material } from '@/components/ui/patch';
import { cn } from '@/lib/cn';

type Props = {
  src: string;
  alt?: string;
  /** Материалът на подложката. По подразбиране плетка — тя е най-тиха. */
  material?: Material;
  /** Наклон в градуси. До 3 — повече чете като счупено. */
  tilt?: number;
  className?: string;
  /** Показва се в горния ъгъл: категория, магазин. */
  badge?: React.ReactNode;
  /** Показва се долу вдясно. */
  note?: React.ReactNode;
  onClick?: () => void;
};

export function LookFrame({
  src,
  alt = '',
  material = 'knit',
  tilt = -1.5,
  className,
  badge,
  note,
  onClick,
}: Props) {
  return (
    <Patch
      material={material}
      tilt={tilt}
      className={cn('enter-pop relative p-2.5', className)}
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-[12px_9px_14px_8px]',
          'ring-[3px] ring-ink',
          onClick && 'pressable cursor-pointer',
        )}
        onClick={onClick}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="block w-full object-cover"
        />

        {badge && (
          <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2.5 py-1 text-[10.5px] font-semibold text-paper backdrop-blur-sm">
            {badge}
          </span>
        )}

        {note && (
          <span className="absolute bottom-2 right-2 rounded-full bg-ink/70 px-2.5 py-1 text-[10.5px] font-semibold text-paper backdrop-blur-sm">
            {note}
          </span>
        )}
      </div>
    </Patch>
  );
}
