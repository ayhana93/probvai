/**
 * ПОЛЕТАТА НА ФОРМИТЕ
 *
 * Извадени тук, защото ги ползват три различни екрана — регистрация,
 * довършване на профил и възстановяване на парола. Три копия на едно и също
 * поле се разминават още при първата поправка.
 *
 * ═══ ЕТИКЕТЪТ Е НАД ПОЛЕТО, НЕ ВЪТРЕ ═══
 *
 * Етикет вътре в полето изчезва в мига, в който човек започне да пише — и
 * точно тогава му трябва. На дълга форма това значи връщане назад, за да се
 * провери кое поле кое е.
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

export function Field({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  inputMode,
  type = 'text',
  hint,
  problem,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: 'numeric' | 'tel';
  type?: 'text' | 'email' | 'password';
  /** Кратък съвет под полето. Показва се винаги. */
  hint?: string;
  /** Проблем с въведеното. Показва се вместо съвета и оцветява рамката. */
  problem?: string | null;
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-semibold text-ink-70">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        type={type}
        aria-invalid={problem ? true : undefined}
        className={cn(
          'mt-1.5 h-14 w-full rounded-[var(--radius-card)] bg-paper-2 px-4 text-[15px]',
          'placeholder:text-ink-25 outline-none',
          'transition-[background-color,box-shadow] duration-[var(--dur-menu)] ease-[var(--ease-out)]',
          'focus:bg-paper-3',
          problem && 'shadow-[inset_0_0_0_2px_var(--color-danger)]',
        )}
      />
      {(problem ?? hint) && (
        <span
          className={cn(
            'mt-1 block text-[12px] leading-snug',
            problem ? 'text-danger' : 'text-ink-25',
          )}
        >
          {problem ?? hint}
        </span>
      )}
    </label>
  );
}

/**
 * Ред за избор. Ползва се и за тайните въпроси, и за вида гардероб.
 *
 * Кръгчето отляво е нарисувано, не е нативно радио копче: нативното не
 * приема цвят и размер по един и същ начин в трите браузъра, а тук то е
 * най-видимият знак кое е избрано.
 */
export function Choice({
  active,
  onClick,
  title,
  note,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  note?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'pressable flex w-full items-start gap-3 rounded-[var(--radius-card)] px-3.5 py-3 text-left',
        'transition-colors duration-[var(--dur-menu)] ease-[var(--ease-out)]',
        active ? 'bg-ink text-paper' : 'bg-paper-3 text-ink',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2',
          active ? 'border-lime bg-lime' : 'border-ink-25',
        )}
      >
        {active && (
          <svg
            viewBox="0 0 24 24"
            className="size-3 text-ink"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 13l4 4 10-10" />
          </svg>
        )}
      </span>

      <span>
        <span className="block text-[14px] font-semibold leading-snug">{title}</span>
        {note && (
          <span
            className={cn(
              'mt-0.5 block text-[12.5px] leading-snug',
              active ? 'text-paper/65' : 'text-ink-45',
            )}
          >
            {note}
          </span>
        )}
      </span>
    </button>
  );
}

/**
 * Полът. Три копчета един до друг, не падащо меню — три възможности се
 * избират по-бързо от списък, който първо трябва да се отвори.
 *
 * „Друго" го има, защото списък от два реда изключва хора без причина, а
 * нищо в приложението не се чупи от трета стойност.
 */
const GENDERS = [
  { value: 'FEMALE', label: 'Жена' },
  { value: 'MALE', label: 'Мъж' },
  { value: 'OTHER', label: 'Друго' },
];

export function GenderPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="pt-1">
      <legend className="text-[13px] font-semibold text-ink-70">Пол</legend>
      <div className="mt-1.5 flex gap-2">
        {GENDERS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'pressable h-14 flex-1 rounded-[var(--radius-card)] text-[14px] font-semibold',
              'transition-colors duration-[var(--dur-menu)] ease-[var(--ease-out)]',
              value === option.value ? 'bg-ink text-paper' : 'bg-paper-2 text-ink-70',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
