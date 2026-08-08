'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Patch } from '@/components/ui/patch';
import { Field, Choice, GenderPicker } from '@/components/ui/form';
import { cn } from '@/lib/cn';

/**
 * РЕГИСТРАЦИЯ
 *
 * ═══ ЗАЩО НА ДВЕ СТЪПКИ, А НЕ НА ЕДНА ═══
 *
 * Полетата са девет. На един екран това е стена, а стена от полета се
 * гледа веднъж и се затваря — точно на мястото, където губим най-много хора.
 *
 * Разделени са там, където сменят темата: първо КОЙ СИ, после КАК ВЛИЗАШ.
 * Двете стъпки са по четири-пет полета и всяка се събира на екран без
 * скролване. Числото отгоре казва колко остава — чакане с видим край се
 * търпи, чакане без край не.
 *
 * Първата стъпка не праща нищо на сървъра. Тя само отключва втората, така
 * че връщането назад не губи написаното.
 */

type Question = { key: string; text: string };

const STEPS = 2;

export default function RegistraciyaPage() {
  const router = useRouter();

  const [step, setStep] = React.useState(1);
  const [questions, setQuestions] = React.useState<Question[]>([]);

  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [gender, setGender] = React.useState<string | null>(null);
  const [age, setAge] = React.useState('');
  const [phone, setPhone] = React.useState('');

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [passwordConfirm, setPasswordConfirm] = React.useState('');
  const [securityQuestion, setSecurityQuestion] = React.useState<string | null>(null);
  const [securityAnswer, setSecurityAnswer] = React.useState('');

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    void fetch('/api/nalog/vaprosi')
      .then((response) => (response.ok ? response.json() : { questions: [] }))
      .then((data: { questions: Question[] }) => {
        if (alive) setQuestions(data.questions ?? []);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const stepOneReady =
    firstName.trim().length >= 2 &&
    lastName.trim().length >= 2 &&
    gender !== null &&
    Number(age) > 0 &&
    phone.replace(/\D/g, '').length >= 8;

  const stepTwoReady =
    email.trim().length > 3 &&
    password.length >= 8 &&
    passwordConfirm.length > 0 &&
    securityQuestion !== null &&
    securityAnswer.trim().length >= 2;

  /** Показва се веднага, а не чак след натискане на копчето. */
  const mismatch =
    passwordConfirm.length > 0 && password !== passwordConfirm
      ? 'Двете пароли не съвпадат.'
      : null;

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (busy || !stepTwoReady || mismatch) return;

    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/nalog/registraciya', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          gender,
          age: Number(age),
          phone: phone.trim(),
          email: email.trim(),
          password,
          passwordConfirm,
          securityQuestion,
          securityAnswer: securityAnswer.trim(),
        }),
      });

      const data = (await response.json()) as
        | { ok: true }
        | { error: { code: string; message: string } };

      if (!response.ok || !('ok' in data)) {
        const message = 'error' in data ? data.error.message : 'Нещо се обърка.';
        setError(message);
        // Грешките от първата стъпка не се виждат от втората. Връщаме го там.
        if ('error' in data && FIRST_STEP_ERRORS.has(data.error.code)) setStep(1);
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
    <main className="mx-auto min-h-dvh w-full max-w-[430px] px-6 pb-12 pt-[max(40px,calc(env(safe-area-inset-top)+20px))]">
      {/* ── Къде сме ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Link
          href={step === 1 ? '/start' : '#'}
          onClick={(event) => {
            if (step === 2) {
              event.preventDefault();
              setStep(1);
              setError(null);
            }
          }}
          className="pressable -ml-1 flex size-10 items-center justify-center rounded-full text-ink-45"
          aria-label="Назад"
        >
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>

        <span className="text-[12.5px] font-semibold text-ink-45">
          Стъпка {step} от {STEPS}
        </span>
      </div>

      {/* Лентата е тънка и не се обяснява. Тя е за окото, не за четене. */}
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-ink/8">
        <div
          className="h-full rounded-full bg-lime transition-[width] duration-[var(--dur-sheet)] ease-[var(--ease-out)]"
          style={{ width: `${(step / STEPS) * 100}%` }}
        />
      </div>

      <h1 className="display mt-6 text-[26px]">
        {step === 1 ? 'Кой си ти' : 'Как ще влизаш'}
      </h1>
      <p className="mt-1.5 text-[14px] leading-snug text-ink-45">
        {step === 1
          ? 'За да са за теб предложенията след пробите.'
          : 'Имейл, парола и един въпрос, ако я забравиш.'}
      </p>

      <form className="mt-7" onSubmit={(event) => void submit(event)}>
        {step === 1 ? (
          <div key="step-1" className="enter-rise space-y-2.5">
            <Field label="Име" value={firstName} onChange={setFirstName} autoComplete="given-name" placeholder="Иван" />
            <Field label="Фамилия" value={lastName} onChange={setLastName} autoComplete="family-name" placeholder="Иванов" />

            <GenderPicker value={gender} onChange={setGender} />

            <div className="flex gap-2.5">
              <div className="w-[110px] shrink-0">
                <Field
                  label="Възраст"
                  value={age}
                  onChange={(value) => setAge(value.replace(/\D/g, '').slice(0, 3))}
                  inputMode="numeric"
                  placeholder="28"
                />
              </div>
              <div className="flex-1">
                <Field
                  label="Телефон"
                  value={phone}
                  onChange={setPhone}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="0888 123 456"
                />
              </div>
            </div>

            <Button
              type="button"
              variant="action"
              size="lg"
              block
              className="!mt-7"
              disabled={!stepOneReady}
              onClick={() => {
                setStep(2);
                setError(null);
              }}
            >
              Продължи
            </Button>
          </div>
        ) : (
          <div key="step-2" className="enter-rise space-y-2.5">
            <Field label="Имейл" value={email} onChange={setEmail} type="email" autoComplete="email" placeholder="твоят@имейл.бг" />
            <Field
              label="Парола"
              value={password}
              onChange={setPassword}
              type="password"
              autoComplete="new-password"
              placeholder="Поне 8 знака"
              hint="Три случайни думи са по-силни от Parola1! и се помнят."
            />
            <Field
              label="Повтори паролата"
              value={passwordConfirm}
              onChange={setPasswordConfirm}
              type="password"
              autoComplete="new-password"
              problem={mismatch}
            />

            {/* ── Тайният въпрос ─────────────────────────────────────────
                Без SMS и без писмо за потвърждение това е единственият път
                обратно към профила. Затова стои тук, а не е скрит в
                настройките — човек, който го пропусне, губи достъпа си. */}
            <Patch material="paper" className="!mt-6 px-4 py-4">
              <div className="text-[14.5px] font-semibold">Ако забравиш паролата</div>
              <p className="mt-1 text-[12.5px] leading-snug text-ink-45">
                Избери въпрос, чийто отговор ще помниш и след години — и който
                не стои в профила ти във Facebook.
              </p>

              <div className="mt-3 space-y-1.5">
                {questions.map((question) => (
                  <Choice
                    key={question.key}
                    active={securityQuestion === question.key}
                    onClick={() => setSecurityQuestion(question.key)}
                    title={question.text}
                  />
                ))}
              </div>

              {securityQuestion && (
                <div className="enter-rise mt-3">
                  <Field
                    label="Твоят отговор"
                    value={securityAnswer}
                    onChange={setSecurityAnswer}
                    autoComplete="off"
                    placeholder="Една дума стига"
                  />
                </div>
              )}
            </Patch>

            <Button
              type="submit"
              variant="action"
              size="lg"
              block
              className="!mt-7"
              disabled={!stepTwoReady || mismatch !== null}
              busy={busy}
            >
              {busy ? 'Създаваме профила...' : 'Готово'}
            </Button>
          </div>
        )}

        {error && (
          <p className="enter-rise mt-3 text-center text-[13px] text-danger">{error}</p>
        )}
      </form>

      <p className={cn('mt-6 text-center text-[13.5px] text-ink-45', step === 2 && 'hidden')}>
        Вече имаш профил?{' '}
        <Link href="/vhod" className="font-semibold text-ink underline underline-offset-4">
          Влез
        </Link>
      </p>
    </main>
  );
}

/** Кои сървърни грешки идват от първата стъпка. */
const FIRST_STEP_ERRORS = new Set([
  'BAD_FIRST_NAME',
  'BAD_LAST_NAME',
  'BAD_GENDER',
  'BAD_AGE',
  'TOO_YOUNG',
  'BAD_PHONE',
  'PHONE_TAKEN',
]);
