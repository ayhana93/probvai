'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { AppleMark, FacebookMark, GoogleMark } from '@/components/ui/brand-marks';
import { cn } from '@/lib/cn';

/**
 * ВХОД
 *
 * ═══ ЗАЩО ДОСТАВЧИЦИТЕ СЕ ПИТАТ, А НЕ СЕ ИЗБРОЯВАТ ═══
 *
 * Google, Apple и Facebook се включват само когато има ключове за тях в
 * средата. Изписани твърдо в кода, те щяха да стоят на екрана и без ключове
 * — и всяко натискане да води до грешка от Auth.js.
 *
 * Затова списъкът идва от `/api/auth/providers`: показва се точно това,
 * което работи. Мъртво копче е по-лошо от липсващо.
 *
 * ═══ ПОДРЕДБАТА ═══
 *
 * Чуждите входове са горе, защото са едно натискане. Имейлът и паролата са
 * отдолу, защото искат писане. Никой не чете списък — всички натискат
 * първото, което познават.
 */

type Provider = { id: string; name: string };

const MARKS: Record<string, React.ReactNode> = {
  google: <GoogleMark />,
  apple: <AppleMark />,
  facebook: <FacebookMark />,
};

const LABELS: Record<string, string> = {
  google: 'Продължи с Google',
  apple: 'Продължи с Apple',
  facebook: 'Продължи с Facebook',
};

export default function VhodPage() {
  const router = useRouter();

  const [providers, setProviders] = React.useState<Provider[]>([]);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    void fetch('/api/auth/providers')
      .then((response) => (response.ok ? response.json() : {}))
      .then((data: Record<string, Provider>) => {
        if (!alive) return;
        // `resend` е magic link-ът на Auth.js. Тук той не се показва —
        // входът с имейл минава през паролата.
        setProviders(
          Object.values(data ?? {}).filter((provider) => provider.id in MARKS),
        );
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

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

      {/* ── Чуждите входове ────────────────────────────────────────────── */}
      {providers.length > 0 && (
        <div className="stagger mt-7 space-y-2.5">
          {providers.map((provider) => (
            <button
              key={provider.id}
              type="button"
              onClick={() => void signIn(provider.id, { callbackUrl: '/' })}
              className={cn(
                'pressable flex h-14 w-full items-center justify-center gap-3',
                'rounded-full bg-paper-2 text-[15px] font-semibold',
              )}
            >
              {MARKS[provider.id]}
              {LABELS[provider.id] ?? provider.name}
            </button>
          ))}

          <div className="flex items-center gap-3 pt-2">
            <span className="h-px flex-1 bg-ink/10" />
            <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-25">
              или
            </span>
            <span className="h-px flex-1 bg-ink/10" />
          </div>
        </div>
      )}

      {/* ── Имейл и парола ─────────────────────────────────────────────── */}
      <form className="mt-5 space-y-2.5" onSubmit={(event) => void submit(event)}>
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
          href="/vhod/zabravena"
          className="pressable text-[13.5px] font-semibold text-ink-45 underline underline-offset-4"
        >
          Забравена парола
        </Link>
      </div>

      <p className="mt-auto pt-10 text-center text-[13.5px] text-ink-45">
        Нямаш профил?{' '}
        <Link href="/registraciya" className="font-semibold text-ink underline underline-offset-4">
          Създай акаунт
        </Link>
      </p>
    </main>
  );
}
