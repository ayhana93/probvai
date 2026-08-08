/**
 * ЛОГОТО
 *
 * Файлът е твой и стои в `apps/web/public/brand/`. Кодът тук не рисува
 * нищо — само го поставя правилно.
 *
 * Съотношението е закачено на широчината, за да не подскача редът около
 * него, докато картинката се зарежда. Без това всяко първо отваряне мърда
 * съдържанието под логото.
 *
 * ═══ ЗАЩО СЕ СЕРВИРА `logo-840.png`, А НЕ `logo.png` ═══
 *
 * Оригиналът е 1536 × 1024 и 2.6 MB. На екрана логото е широко 188 пиксела
 * на началния екран и 280 на входа — тоест теглим 2.6 MB, за да покажем
 * нещо колкото визитка, и то на ПЪРВИЯ екран.
 *
 * `logo-840.png` е същата картинка, смалена до 840 пиксела и свита до 93 KB.
 * Толкова стигат за 280 пиксела на екран с тройна плътност; повече пиксели
 * няма къде да се покажат.
 *
 * Оригиналът остава в хранилището — той е източникът. Смени ли се, копието
 * се прави наново с `npm run logo`.
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';
import { useImageStatus } from '@/lib/use-image-status';

/** Съотношение на изходния файл: 1536 × 1024. */
const RATIO = 1536 / 1024;

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
        title="Липсва /brand/logo-840.png"
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
      src="/brand/logo-840.png"
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
