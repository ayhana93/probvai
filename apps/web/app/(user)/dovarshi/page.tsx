'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Patch } from '@/components/ui/patch';
import { Sparks } from '@/components/ui/scribble';
import { cn } from '@/lib/cn';

/**
 * ДОВЪРШВАНЕ НА РЕГИСТРАЦИЯТА
 *
 * Пита се веднъж, след първото влизане. Пет полета и нито едно повече:
 * всяко допълнително поле изяжда процент от хората, които стигат до края.
 *
 * ═══ ЗАЩО ИЗОБЩО ПИТАМЕ ЗА ПОЛ ═══
 *
 * Не за да делим хората, а за да не показваме дамски обувки под визия на
 * мъж. Предложение, което очевидно не гледа кой го чете, обучава човека да
 * пропуска всички предложения — включително добрите.
 *
 * Има и трета възможност: „Друго". Списък от два реда изключва хора без
 * причина, а нищо в приложението не се чупи от трета стойност.
 *
 * ═══ ПУБЛИЧЕН ГАРДЕРОБ ═══
 *
 * Изключен по подразбиране. Публикуването на снимка с лице е решение с
 * последствия, които не се връщат назад — то се взима нарочно, а не се
 * получава, защото някой е бързал през регистрацията.
 *
 * И дори включено, то не публикува нищо само. Дава само ПРАВОТО: всяка
 * визия излиза навън с отделно натискане върху нея.
 */

const GENDERS = [
  { value: 'FEMALE', label: 'Жена' },
  { value: 'MALE', label: 'Мъж' },
  { value: 'OTHER', label: 'Друго' },
] as const;

type GenderValue = (typeof GENDERS)[number]['value'];

export default function RegistraciyaPage() {
  const router = useRouter();

  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [gender, setGender] = React.useState<GenderValue | null>(null);
  const [age, setAge] = React.useState('');
  const [wardrobePublic, setWardrobePublic] = React.useState(false);

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const ready =
    firstName.trim().length >= 2 &&
    lastName.trim().length >= 2 &&
    gender !== null &&
    Number(age) > 0;

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (busy || !ready) return;

    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          gender,
          age: Number(age),
          wardrobePublic,
        }),
      });

      const data = (await response.json()) as
        | { ok: true; notice?: string }
        | { error: { message: string } };

      if (!response.ok || !('ok' in data)) {
        setError('error' in data ? data.error.message : 'Нещо се обърка.');
        setBusy(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('Няма връзка. Провери интернета и пробвай пак.');
      setBusy(false);
    }
  }

  return (
    <main className="px-5 pb-10 pt-8">
      <div className="flex items-center gap-2">
        <h1 className="display text-[28px]">Здравей</h1>
        <Sparks className="mb-1.5 h-3.5 w-6 text-violet" />
      </div>
      <p className="mt-2 text-[14px] leading-snug text-ink-45">
        Още няколко неща и почваме. Отнема половин минута.
      </p>

      <form className="mt-7" onSubmit={(event) => void submit(event)}>
        {/* ── Име ─────────────────────────────────────────────────────────
            Две отделни полета, не едно. „Име и фамилия" в едно поле се
            попълва по три различни начина и после нищо не се сортира. */}
        <div className="space-y-2.5">
          <Field
            label="Име"
            value={firstName}
            onChange={setFirstName}
            autoComplete="given-name"
            placeholder="Иван"
          />
          <Field
            label="Фамилия"
            value={lastName}
            onChange={setLastName}
            autoComplete="family-name"
            placeholder="Иванов"
          />
        </div>

        {/* ── Пол ─────────────────────────────────────────────────────────
            Три копчета един до друг, не падащо меню. Три възможности се
            избират по-бързо от списък, който трябва да се отвори. */}
        <fieldset className="mt-6">
          <legend className="text-[13px] font-semibold text-ink-70">Пол</legend>
          <p className="mt-1 text-[12.5px] leading-snug text-ink-45">
            За да са за теб предложенията след пробите.
          </p>

          <div className="mt-2.5 flex gap-2">
            {GENDERS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={gender === option.value}
                onClick={() => setGender(option.value)}
                className={cn(
                  'pressable h-12 flex-1 rounded-full text-[14px] font-semibold',
                  'transition-colors duration-[var(--dur-menu)] ease-[var(--ease-out)]',
                  gender === option.value
                    ? 'bg-ink text-paper'
                    : 'bg-paper-2 text-ink-70',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        {/* ── Възраст ───────────────────────────────────────────────────── */}
        <div className="mt-6">
          <Field
            label="Възраст"
            value={age}
            onChange={(value) => setAge(value.replace(/\D/g, '').slice(0, 3))}
            inputMode="numeric"
            placeholder="28"
          />
        </div>

        {/* ── Гардеробът ────────────────────────────────────────────────── */}
        <Patch material="paper" className="mt-6 px-4 py-4">
          <div className="text-[15px] font-semibold">Гардеробът ти</div>

          <div className="mt-3 space-y-2">
            <Choice
              active={!wardrobePublic}
              onClick={() => setWardrobePublic(false)}
              title="Личен"
              note="Никой освен теб не вижда пробите ти."
            />
            <Choice
              active={wardrobePublic}
              onClick={() => setWardrobePublic(true)}
              title="Публичен"
              note="Можеш да пускаш избрани визии в Lookbook. Всяка се пуска поотделно, с натискане."
            />
          </div>

          <p className="mt-3 text-[12px] leading-snug text-ink-25">
            Може да се смени по всяко време от настройките.
          </p>
        </Patch>

        <Button
          type="submit"
          variant="action"
          size="lg"
          block
          className="mt-7"
          disabled={!ready}
          busy={busy}
        >
          {busy ? 'Записваме...' : 'Готово'}
        </Button>

        {error && (
          <p className="enter-rise mt-3 text-center text-[13px] text-danger">{error}</p>
        )}
      </form>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: 'numeric';
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
        className={cn(
          'mt-1.5 h-14 w-full rounded-[var(--radius-card)] bg-paper-2 px-4 text-[15px]',
          'placeholder:text-ink-25',
          'outline-none transition-[background-color] duration-[var(--dur-menu)] ease-[var(--ease-out)]',
          'focus:bg-paper-3',
        )}
      />
    </label>
  );
}

function Choice({
  active,
  onClick,
  title,
  note,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  note: string;
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
          <svg viewBox="0 0 24 24" className="size-3 text-ink" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4 10-10" />
          </svg>
        )}
      </span>

      <span>
        <span className="block text-[14.5px] font-semibold">{title}</span>
        <span className={cn('mt-0.5 block text-[12.5px] leading-snug', active ? 'text-paper/65' : 'text-ink-45')}>
          {note}
        </span>
      </span>
    </button>
  );
}
