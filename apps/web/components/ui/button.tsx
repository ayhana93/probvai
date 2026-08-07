/**
 * КОПЧЕТА
 *
 * Три решения, които не са по вкус:
 *
 * 1. Обратната връзка е на НАТИСКАНЕ, не на пускане. `scale(0.97)` при
 *    `:active` казва на човека, че интерфейсът го е чул — още преди да е
 *    станало каквото и да било.
 *
 * 2. Едно лайм копче на екран. Лаймът е цветът на действието; сложиш ли
 *    две, нито едно вече не е ГЛАВНОТО.
 *
 * 3. Преходът е само на `transform`, никога `all`. `all` анимира и неща,
 *    които не сме искали, и пада кадри.
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

type Variant = 'action' | 'ink' | 'quiet' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  // Главното действие. Лайм на черно — не се пропуска.
  action: 'bg-lime text-ink shadow-[0_2px_0_var(--color-lime-deep)] active:shadow-[0_1px_0_var(--color-lime-deep)]',
  ink: 'bg-ink text-paper shadow-[0_2px_0_rgba(0,0,0,.35)]',
  quiet: 'bg-paper-2 text-ink',
  ghost: 'bg-transparent text-ink-70',
  danger: 'bg-danger text-white shadow-[0_2px_0_rgba(0,0,0,.2)]',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-4 text-[13px] gap-1.5',
  md: 'h-12 px-5 text-[15px] gap-2',
  // 56px — палецът стига без да се напряга.
  lg: 'h-14 px-6 text-[17px] gap-2.5',
};

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  /** Показва, че нещо тече. Копчето остава натискаемо визуално, но е disabled. */
  busy?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, Props>(
  function Button(
    { variant = 'quiet', size = 'md', block, busy, className, children, disabled, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled ?? busy}
        aria-busy={busy || undefined}
        className={cn(
          'pressable inline-flex select-none items-center justify-center',
          'rounded-full font-semibold tracking-[-0.01em]',
          'disabled:pointer-events-none disabled:opacity-40',
          VARIANTS[variant],
          SIZES[size],
          block && 'w-full',
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

/**
 * Кръгло копче само с икона. Иконата НЕ е етикет — затова `label` е
 * задължителен и отива в `aria-label`.
 */
type IconProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  variant?: Variant;
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconProps>(
  function IconButton({ label, variant = 'quiet', className, children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        aria-label={label}
        className={cn(
          'pressable inline-grid size-11 place-items-center rounded-full',
          VARIANTS[variant],
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
