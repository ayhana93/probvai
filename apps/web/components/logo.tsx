/**
 * ЛОГОТО
 *
 * Файлът е твой и стои в `apps/web/public/brand/`. Кодът тук не рисува
 * нищо — само го поставя правилно.
 *
 * Съотношението е закачено на широчината, за да не подскача редът около
 * него, докато картинката се зарежда. Без това всяко първо отваряне мърда
 * съдържанието под логото.
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';
import { useImageStatus } from '@/lib/use-image-status';

/** Съотношение на изходния файл: 1512 × 1010. */
const RATIO = 1512 / 1010;

export function Logo({
  width = 220,
  className,
  priority,
}: {
  width?: number;
  className?: string;
  priority?: boolean;
}) {
  const image = useImageStatus();
  const height = Math.round(width / RATIO);

  if (image.failed) {
    return (
      <span
        role="img"
        aria-label="ПРОБВАЙ"
        title="Липсва /brand/logo.png"
        style={{ width, height }}
        className={cn(
          'display grid place-items-center rounded-xl border-2 border-dashed border-ink-25 text-ink-25',
          className,
        )}
      >
        ПРОБВАЙ
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={image.ref}
      src="/brand/logo.png"
      alt="ПРОБВАЙ"
      width={width}
      height={height}
      draggable={false}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      onError={image.onError}
      className={cn('select-none object-contain', className)}
      style={{ width, height }}
    />
  );
}
