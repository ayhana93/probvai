'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/form';
import { Patch } from '@/components/ui/patch';

/**
 * ЗАБРАВЕНА ПАРОЛА
 *
 * Три стъпки на един екран: имейл → таен въпрос → нова парола. Всяка се
 * появява, когато предишната е готова.
 *
 * ═══ ЗАЩО НЕ ПИШЕ „НЯМА ТАКЪВ ПРОФИЛ" ═══
 *
 * За непознат имейл екранът показва въпрос също както за познат. Иначе
 * този екран щеше да е безплатна проверка кой има профил при нас — подаваш
 * списък адреси и записваш кои минават нататък.
 *
 * Въпросът за непознат адрес е винаги един и същ (избран по хеш на самия
 * адрес), тоест повторното питане не издава измамата. Отговорът после не
 * съвпада с нищо.
 *
 * ═══ СЛЕД СМЯНА НЕ ВЛИЗАМЕ АВТОМАТИЧНО ═══
 *
 * Смяната на парола обикновено значи, че някой друг е имал достъп. Затова
 * всички отворени сесии падат — включително тази, ако е имало такава — и
 * човекът влиза наново. Една стъпка повече, но след нея е ясно кой е вътре.
 */

export default function ZabravenaPage() {
  const router = useRouter();

  const [email, setEmail] = React.useState('');
  const [question, setQuestion] = React.useState<string | null>(null);
  const [answer, setAnswer] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [passwordConfirm, setPasswordConfirm] = React.useState('');

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const mismatch =
    passwordConfirm.length > 0 && password !== passwordConfirm
      ? 'Двете пароли не съвпадат.'
      : null;

  async function askQuestion(): Promise<void> {
    if (busy || email.trim().length < 4) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/nalog/vapros', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = (await response.json()) as
        | { question: string; text: string }
        | { error: { message: string } };

      if (!response.ok || !('text' in data)) {
        setError('error' in data ? data.error.message : 'Нещо се обърка.');
        setBusy(false);
        return;
      }

      setQuestion(data.text);
    } catch {
      setError('Няма връзка. Провери интернета и пробвай пак.');
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (busy || mismatch) return;

    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/nalog/nova-parola', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          answer: answer.trim(),
          password,
          passwordConfirm,
        }),
      });

      const data = (await response.json()) as
        | { ok: true }
        | { error: { message: string } };

      if (!response.ok || !('ok' in data)) {
        setError('error' in data ? data.error.message : 'Нещо се обърка.');
        setBusy(false);
        return;
      }

      setDone(true);
    } catch {
      setError('Няма връзка. Провери интернета и пробвай пак.');
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center justify-center px-8 text-center">
        <Patch material="knit" tilt={-2} className="grid size-20 place-items-center">
          <svg viewBox="0 0 24 24" className="enter-pop size-9 text-ink" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12.5l5 5L20 6.5" />
          </svg>
        </Patch>

        <h1 className="display mt-6 text-[24px]">Паролата е сменена</h1>
        <p className="mt-2 max-w-[280px] text-[14px] leading-snug text-ink-45">
          Всички отворени сесии са прекратени — и твоите, и чуждите, ако е
          имало такива. Влез с новата парола.
        </p>

        <Button
          variant="action"
          size="lg"
          className="mt-7 w-full max-w-[280px]"
          onClick={() => router.push('/vhod')}
        >
          Към входа
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] px-6 pb-12 pt-[max(40px,calc(env(safe-area-inset-top)+20px))]">
      <Link
        href="/vhod"
        className="pressable -ml-1 flex size-10 items-center justify-center rounded-full text-ink-45"
        aria-label="Назад"
      >
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </Link>

      <h1 className="display mt-4 text-[26px]">Забравена парола</h1>
      <p className="mt-1.5 text-[14px] leading-snug text-ink-45">
        {question
          ? 'Отговори на въпроса, който си избрал при регистрацията.'
          : 'Напиши имейла, с който си се регистрирал.'}
      </p>

      <form className="mt-7 space-y-2.5" onSubmit={(event) => void submit(event)}>
        <Field
          label="Имейл"
          value={email}
          onChange={(value) => {
            setEmail(value);
            // Смени ли имейла, въпросът вече не е негов.
            if (question) {
              setQuestion(null);
              setAnswer('');
            }
          }}
          type="email"
          autoComplete="email"
          placeholder="твоят@имейл.бг"
        />

        {!question ? (
          <Button
            type="button"
            variant="action"
            size="lg"
            block
            className="!mt-5"
            disabled={email.trim().length < 4}
            busy={busy}
            onClick={() => void askQuestion()}
          >
            {busy ? 'Търсим...' : 'Продължи'}
          </Button>
        ) : (
          <div className="enter-rise space-y-2.5">
            <Patch material="paper" className="!mt-5 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-45">
                Твоят таен въпрос
              </div>
              <p className="mt-1.5 text-[15px] font-semibold leading-snug">{question}</p>

              <div className="mt-3">
                <Field
                  label="Отговор"
                  value={answer}
                  onChange={setAnswer}
                  autoComplete="off"
                  placeholder="Както си го написал тогава"
                  hint="Големите и малките букви нямат значение."
                />
              </div>
            </Patch>

            <Field
              label="Нова парола"
              value={password}
              onChange={setPassword}
              type="password"
              autoComplete="new-password"
              placeholder="Поне 8 знака"
            />
            <Field
              label="Повтори новата парола"
              value={passwordConfirm}
              onChange={setPasswordConfirm}
              type="password"
              autoComplete="new-password"
              problem={mismatch}
            />

            <Button
              type="submit"
              variant="action"
              size="lg"
              block
              className="!mt-6"
              disabled={
                answer.trim().length < 2 ||
                password.length < 8 ||
                passwordConfirm.length === 0 ||
                mismatch !== null
              }
              busy={busy}
            >
              {busy ? 'Сменяме...' : 'Смени паролата'}
            </Button>
          </div>
        )}

        {error && (
          <p className="enter-rise mt-3 text-center text-[13px] text-danger">{error}</p>
        )}
      </form>
    </main>
  );
}
