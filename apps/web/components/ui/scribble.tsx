/**
 * РЪЧНИТЕ ЩРИХИ
 *
 * В логото над и под буквите има маркерни драскулки. Те са това, което
 * прави колажа човешки, а не изчистен вектор. Тук са същите щрихи, за да
 * могат да се сложат до заглавие или под важно число.
 *
 * Декоративни са — затова са `aria-hidden`. Читателят на екрана няма какво
 * да чуе от една драскулка.
 */

import { cn } from '@/lib/cn';

type Props = {
  className?: string;
  color?: string;
};

/** Две къси чертички — акцент над заглавие, като в логото. */
export function Sparks({ className, color = 'currentColor' }: Props) {
  return (
    <svg
      viewBox="0 0 44 26"
      fill="none"
      aria-hidden="true"
      className={cn('h-4 w-7', className)}
    >
      <path
        d="M8 24 L17 3"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M27 24 L34 4"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Подчертаване на един дъх — под заглавие или под число. */
export function Underscribble({ className, color = 'currentColor' }: Props) {
  return (
    <svg
      viewBox="0 0 160 22"
      fill="none"
      aria-hidden="true"
      className={cn('h-3 w-full', className)}
      preserveAspectRatio="none"
    >
      <path
        d="M6 15 C34 4, 52 18, 78 9 S128 4, 154 12"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Зигзаг като в долния ляв ъгъл на логото. */
export function Zigzag({ className, color = 'currentColor' }: Props) {
  return (
    <svg
      viewBox="0 0 120 34"
      fill="none"
      aria-hidden="true"
      className={cn('h-5 w-20', className)}
    >
      <path
        d="M6 26 L34 8 L20 27 L52 7 L38 28 L70 8 L56 27 L88 9 L76 27 L114 10"
        stroke={color}
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Кръг с маркер — огражда нещо важно. */
export function CircleMark({ className, color = 'currentColor' }: Props) {
  return (
    <svg
      viewBox="0 0 200 100"
      fill="none"
      aria-hidden="true"
      className={cn('h-full w-full', className)}
      preserveAspectRatio="none"
    >
      <path
        d="M100 8 C42 8, 10 28, 10 50 C10 74, 48 92, 104 92 C158 92, 190 72, 190 50 C190 27, 156 10, 96 11"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
