'use client';

import * as React from 'react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

/**
 * ВХОД
 *
 * Първият екран, който човек вижда. Логото е тук — цяло, без да е стиснато
 * в ъгъла.
 *
 * Подредбата на входовете не е случайна: Google е горе, защото е най-често
 * използваният, а имейлът е долу, защото иска най-много стъпки. Никой не
 * чете списък — всички натискат първото, което познават.
 */

type Provider = { id: string; label: string; icon: React.ReactNode };

const G = (
  <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
    <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4Z" />
    <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14Z" />
    <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 2.9 14.7 2 12 2a10 10 0 0 0-8.9 5.4L6.4 10c.8-2.3 3-4.1 5.6-4.1Z" />
  </svg>
);

const APPLE = (
  <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
    <path d="M16.4 12.7c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.3.8-.7 0-1.7-.8-2.8-.8-1.5 0-2.8.8-3.6 2.1-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7s1.6.7 2.8.7c1.1 0 1.9-1 2.6-2.1a9 9 0 0 0 1.2-2.4c-.1 0-2.2-.9-2.2-3.2ZM14.2 5.9c.6-.7 1-1.7.9-2.7-.9 0-2 .6-2.6 1.3-.6.6-1 1.7-.9 2.6 1 .1 2-.5 2.6-1.2Z" />
  </svg>
);

const FB = (
  <svg viewBox="0 0 24 24" className="size-5" fill="#1877F2" aria-hidden="true">
    <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z" />
  </svg>
);

const PROVIDERS: Provider[] = [
  { id: 'google', label: 'Продължи с Google', icon: G },
  { id: 'apple', label: 'Продължи с Apple', icon: APPLE },
  { id: 'facebook', label: 'Продължи с Facebook', icon: FB },
];

export default function VhodPage() {
  const [email, setEmail] = React.useState('');
  const [sent, setSent] = React.useState(false);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 pb-10 pt-14">
      {/* ── Логото ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center">
        <Logo width={280} priority />
        <p className="mt-4 text-center text-[15px] leading-snug text-ink-70">
          Виж как ти стои дрехата,
          <br />
          преди да я поръчаш.
        </p>
      </div>

      {/* ── Входовете ──────────────────────────────────────────────────── */}
      <div className="stagger mt-10 space-y-2.5">
        {PROVIDERS.map((provider) => (
          <button
            key={provider.id}
            className={cn(
              'pressable flex h-14 w-full items-center justify-center gap-3',
              'rounded-full bg-paper-2 text-[15px] font-semibold',
            )}
          >
            {provider.icon}
            {provider.label}
          </button>
        ))}
      </div>

      {/* ── Имейл ──────────────────────────────────────────────────────── */}
      <div className="mt-7">
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-ink/10" />
          <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-25">
            или
          </span>
          <span className="h-px flex-1 bg-ink/10" />
        </div>

        {sent ? (
          <div className="enter-pop mt-5 rounded-[var(--radius-card)] bg-lime/25 p-4 text-center">
            <div className="text-[15px] font-semibold">Провери пощата си</div>
            <p className="mt-1 text-[13.5px] leading-snug text-ink-70">
              Пратихме връзка на {email}. Валидна е 24 часа.
            </p>
          </div>
        ) : (
          <form
            className="mt-5 space-y-2.5"
            onSubmit={(event) => {
              event.preventDefault();
              if (email.trim()) setSent(true);
            }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="твоят@имейл.бг"
              autoComplete="email"
              className={cn(
                'h-14 w-full rounded-full bg-paper-2 px-5 text-[15px]',
                'placeholder:text-ink-25',
                'outline-none transition-[background-color] duration-[var(--dur-menu)] ease-[var(--ease-out)]',
                'focus:bg-paper-3',
              )}
            />
            <Button type="submit" variant="ink" size="lg" block>
              Прати ми връзка
            </Button>
          </form>
        )}
      </div>

      <p className="mt-auto pt-10 text-center text-[12px] leading-relaxed text-ink-25">
        С влизането приемаш{' '}
        <a href="/usloviya" className="underline underline-offset-2">Условията</a> и{' '}
        <a href="/poveritelnost" className="underline underline-offset-2">Политиката за поверителност</a>.
      </p>
    </main>
  );
}
