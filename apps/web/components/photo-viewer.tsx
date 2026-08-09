/**
 * СНИМКАТА НА ЦЯЛ ЕКРАН
 *
 * Натиска се готовата проба и тя се отваря голяма, без рамка, без копчета
 * и без нищо друго на екрана.
 *
 * ═══ ЗАЩО БЕЗ РАМКАТА ═══
 *
 * Рамката е за списъка и за споделянето — там тя казва откъде идва
 * снимката. Тук човек е дошъл да разгледа ЛИЦЕТО и как стои дрехата.
 * Всичко наоколо в този момент е пречка.
 *
 * ═══ ЗАТВАРЯ СЕ С НАТИСКАНЕ КЪДЕТО И ДА Е ═══
 *
 * Има и кръстче в ъгъла — то е за хората, които го търсят. Но целият фон
 * също затваря, защото жестът „натисни встрани" е това, което всеки прави
 * пръв. Плюс `Esc` за клавиатура.
 *
 * ═══ ЗАЩО СКРОЛЪТ СЕ ЗАКЛЮЧВА ═══
 *
 * Отдолу стои дълга страница. Без заключване прелистването върху снимката
 * скролва НЕЯ — и при затваряне екранът е на съвсем друго място.
 */

'use client';

import * as React from 'react';
import { CrossIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

export function PhotoViewer({
  src,
  alt = 'Готовата проба',
  onClose,
  bare = false,
  guard = false,
}: {
  src: string;
  alt?: string;
  onClose: () => void;
  /**
   * Без кръстче. Ползва се в Lookbook, където снимката е чужда и екранът
   * трябва да е само снимка — натискане където и да е я затваря.
   */
  bare?: boolean;
  /**
   * Пречи на задържането да отвори „Запази снимката".
   *
   * ⚠ Това НЕ е защита. Скрийншот не може да бъде спрян от уеб страница на
   * нито един браузър, а човек с малко желание стига до файла. Целта е
   * друга: случайното задържане върху чужда снимка да не предлага сваляне,
   * все едно е наша.
   */
  guard?: boolean;
}) {
  React.useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      className="enter-pop fixed inset-0 z-[60] grid place-items-center bg-ink/95 p-3"
      style={{
        paddingTop: 'max(12px, env(safe-area-inset-top))',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        onContextMenu={guard ? (event) => event.preventDefault() : undefined}
        className={cn(
          'max-h-full max-w-full object-contain',
          guard && 'no-save',
        )}
      />

      {!bare && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Затвори"
          className="pressable absolute right-4 grid size-11 place-items-center rounded-full bg-paper/15 text-paper backdrop-blur-sm"
          style={{ top: 'max(16px, calc(env(safe-area-inset-top) + 8px))' }}
        >
          <CrossIcon className="size-5" />
        </button>
      )}
    </div>
  );
}
