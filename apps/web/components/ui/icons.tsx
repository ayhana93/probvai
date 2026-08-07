/**
 * Иконите. Рисувани на място, не от библиотека — трябват ни осем, а всяка
 * библиотека носи стотици и тежи в bundle-а.
 *
 * Всички са на решетка 24×24, с еднаква дебелина на щриха. Различната
 * дебелина между две икони една до друга се вижда веднага, дори човек да
 * не знае какво точно го дразни.
 */

import { cn } from '@/lib/cn';

type Props = { className?: string };

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function GearIcon({ className }: Props) {
  return (
    <svg {...base} className={cn('size-[22px]', className)}>
      <path d="M12.5 2.5h-1a1.8 1.8 0 0 0-1.8 1.8v.3a1.6 1.6 0 0 1-.9 1.4l-.5.3a1.6 1.6 0 0 1-1.6 0l-.2-.1a1.8 1.8 0 0 0-2.4.7l-.5.9a1.8 1.8 0 0 0 .6 2.4l.2.1a1.6 1.6 0 0 1 .8 1.4v.6a1.6 1.6 0 0 1-.8 1.4l-.2.1a1.8 1.8 0 0 0-.6 2.4l.5.9a1.8 1.8 0 0 0 2.4.7l.2-.1a1.6 1.6 0 0 1 1.6 0l.5.3c.5.3.9.8.9 1.4v.3c0 1 .8 1.8 1.8 1.8h1c1 0 1.8-.8 1.8-1.8v-.3c0-.6.4-1.1.9-1.4l.5-.3a1.6 1.6 0 0 1 1.6 0l.2.1c.9.5 2 .2 2.4-.7l.5-.9a1.8 1.8 0 0 0-.6-2.4l-.2-.1a1.6 1.6 0 0 1-.8-1.4v-.6c0-.6.3-1.1.8-1.4l.2-.1c.9-.5 1.1-1.6.6-2.4l-.5-.9a1.8 1.8 0 0 0-2.4-.7l-.2.1a1.6 1.6 0 0 1-1.6 0l-.5-.3a1.6 1.6 0 0 1-.9-1.4v-.3c0-1-.8-1.8-1.8-1.8Z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

export function ArrowRightIcon({ className }: Props) {
  return (
    <svg {...base} strokeWidth={2.5} className={cn('size-6', className)}>
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

export function ChevronRightIcon({ className }: Props) {
  return (
    <svg {...base} strokeWidth={2.5} className={cn('size-4', className)}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function CheckIcon({ className }: Props) {
  return (
    <svg {...base} strokeWidth={3.2} className={cn('size-3.5', className)}>
      <path d="M5 13l4 4 10-10" />
    </svg>
  );
}

export function CrossIcon({ className }: Props) {
  return (
    <svg {...base} strokeWidth={3.2} className={cn('size-3.5', className)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function ShareIcon({ className }: Props) {
  return (
    <svg {...base} className={cn('size-5', className)}>
      <path d="M12 15V3M8 6.5 12 3l4 3.5" />
      <path d="M4.5 13v6a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-6" />
    </svg>
  );
}

export function SaveIcon({ className }: Props) {
  return (
    <svg {...base} className={cn('size-5', className)}>
      <path d="M12 3v12M8 11.5 12 15l4-3.5" />
      <path d="M4.5 15v4a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-4" />
    </svg>
  );
}

export function BagIcon({ className }: Props) {
  return (
    <svg {...base} className={cn('size-5', className)}>
      <path d="M5 8h14l-1 12H6L5 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

export function RetryIcon({ className }: Props) {
  return (
    <svg {...base} className={cn('size-5', className)}>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v4.5h-4.5" />
    </svg>
  );
}
