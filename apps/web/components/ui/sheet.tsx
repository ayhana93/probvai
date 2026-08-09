/**
 * ЛИСТ ОТДОЛУ
 *
 * Три неща, които го правят да не изглежда като уеб:
 *
 * 1. `translateY(100%)` вместо пиксели. Процентът е спрямо собствената
 *    височина на листа — работи еднакво и с три реда, и с трийсет.
 *
 * 2. Кривата е тази от iOS (`--ease-drawer`). Стандартните CSS криви
 *    правят листа да изглежда, че се влачи.
 *
 * 3. Прекъсваеми преходи, не keyframes. Отвориш ли и веднага затвориш,
 *    листът тръгва назад от там, докъдето е стигнал, а не от нулата.
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
};

export function Sheet({ open, onClose, title, children, className }: Props) {
  const [mounted, setMounted] = React.useState(false);
  const titleId = React.useId();

  React.useEffect(() => {
    if (open) {
      // Един кадър по-късно, за да има от какво да тръгне преходът.
      const id = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(id);
    }
    setMounted(false);
    return undefined;
  }, [open]);

  // Escape затваря. Клавиатурното действие не се анимира по-дълго от нужното.
  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined}>
      <button
        aria-label="Затвори"
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-ink/45 backdrop-blur-[2px]',
          'transition-opacity duration-[var(--dur-sheet)] ease-[var(--ease-drawer)]',
          mounted ? 'opacity-100' : 'opacity-0',
        )}
      />

      <div
        className={cn(
          'absolute inset-x-0 bottom-0 mx-auto max-w-[430px]',
          'rounded-t-[26px] bg-paper pb-[max(20px,env(safe-area-inset-bottom))]',
          'shadow-[0_-8px_40px_-12px_rgba(20,20,22,.5)]',
          'transition-transform duration-[var(--dur-sheet)] ease-[var(--ease-drawer)]',
          mounted ? 'translate-y-0' : 'translate-y-full',
          className,
        )}
      >
        {/* Дръжката казва „това се дърпа", без да го пише. */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-9 rounded-full bg-ink/15" />
        </div>

        {title && (
          <h2 id={titleId} className="display px-6 pt-2 pb-1 text-[19px]">
            {title}
          </h2>
        )}

        <div className="px-6 pt-2">{children}</div>
      </div>
    </div>
  );
}
