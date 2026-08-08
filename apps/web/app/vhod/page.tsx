'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { R } from '@/lib/routes';

/**
 * ВХОД
 *
 * ═══ ЗАСЕГА САМО ИМЕЙЛ И ПАРОЛА ═══
 *
 * Копчетата за Google, Apple и Facebook ги нямаше как да работят без ключове
 * от тях, а всяко от трите иска отделна подготовка — Apple и пари. По
 * решение на клиента изчакват.
 *
 * Кодът в `auth.ts` обаче ги ПОДДЪРЖА: появят ли се ключовете в средата,
 * доставчиците се включват сами. Тук остава да се върнат копчетата и
 * знаците им, които стоят в `components/ui/brand-marks.tsx`.
 */

export default function VhodPage() {
  const router = useRouter();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/nalog/vhod', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = (await response.json()) as
        | { ok: true }
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

  const ready = email.trim().length > 0 && password.length > 0;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 pb-10 pt-[max(48px,calc(env(safe-area-inset-top)+24px))]">
      <div className="flex flex-col items-center">
        <Logo width={228} priority />
        <h1 className="display mt-5 text-[22px]">Влез в профила си</h1>
      </div>

      <form className="mt-7 space-y-2.5" onSubmit={(event) => void submit(event)}>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="твоят@имейл.бг"
          autoComplete="email"
          className={cn(
            'h-14 w-full rounded-full bg-paper-2 px-5 text-[15px]',
            'placeholder:text-ink-25 outline-none',
            'transition-[background-color] duration-[var(--dur-menu)] ease-[var(--ease-out)]',
            'focus:bg-paper-3',
          )}
        />
        <input
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Парола"
          autoComplete="current-password"
          className={cn(
            'h-14 w-full rounded-full bg-paper-2 px-5 text-[15px]',
            'placeholder:text-ink-25 outline-none',
            'transition-[background-color] duration-[var(--dur-menu)] ease-[var(--ease-out)]',
            'focus:bg-paper-3',
          )}
        />

        <Button type="submit" variant="action" size="lg" block disabled={!ready} busy={busy}>
          {busy ? 'Влизаме...' : 'Влез'}
        </Button>
      </form>

      {error && (
        <p className="enter-rise mt-3 text-center text-[13px] text-danger">{error}</p>
      )}

      <div className="mt-4 flex flex-col items-center gap-3">
        <Link
          href={R.forgotPassword}
          className="pressable text-[13.5px] font-semibold text-ink-45 underline underline-offset-4"
        >
          Забравена парола
        </Link>
      </div>

      <p className="mt-auto pt-10 text-center text-[13.5px] text-ink-45">
        Нямаш профил?{' '}
        <Link href={R.register} className="font-semibold text-ink underline underline-offset-4">
          Създай акаунт
        </Link>
      </p>
    </main>
  );
}
