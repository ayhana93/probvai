/**
 * СЛЕДЕНЕ НА ЕДНА ГЕНЕРАЦИЯ
 *
 * Основното е Server-Sent Events. Но SSE връзка може да умре тихо —
 * мобилна мрежа, прокси, заспал таб — и тогава екранът остава да чака
 * вечно нещо, което вече е готово.
 *
 * Затова отдолу върви и бавно допитване на всеки 5 секунди. То не товари
 * нищо (една заявка на 5 секунди), а спасява точно случая, в който SSE е
 * паднал, без да каже.
 */

'use client';

import * as React from 'react';

export type GenerationStatus = 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED' | 'REFUNDED';

export type GenerationView = {
  id: string;
  status: GenerationStatus;
  aspectRatio: string;
  watermarked: boolean;
  merchant: string | null;
  errorCode: string | null;
  errorMessage?: string | null;
  createdAt: string;
  elapsedSeconds: number;
  resultUrl: string | null;
  personUrl: string | null;
};

const POLL_MS = 5_000;

function isTerminal(status: GenerationStatus): boolean {
  return status === 'DONE' || status === 'FAILED' || status === 'REFUNDED';
}

export function useGeneration(id: string, timeoutSeconds = 90) {
  const [view, setView] = React.useState<GenerationView | null>(null);
  const [elapsed, setElapsed] = React.useState(0);
  const [timedOut, setTimedOut] = React.useState(false);

  const done = view ? isTerminal(view.status) : false;

  // ── Броячът ─────────────────────────────────────────────────────────────
  // Върви на клиента, за да не чака мрежата. Спира в мига, в който
  // генерацията приключи.
  React.useEffect(() => {
    if (done) return undefined;
    const started = Date.now();
    const timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - started) / 1000);
      setElapsed(seconds);
      if (seconds >= timeoutSeconds) setTimedOut(true);
    }, 1000);
    return () => clearInterval(timer);
  }, [done, timeoutSeconds]);

  // ── Живият поток ────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (done) return undefined;

    const source = new EventSource(`/api/generate/${id}/stream`);

    source.addEventListener('state', (event) => {
      try {
        setView(JSON.parse((event as MessageEvent).data) as GenerationView);
      } catch {
        // Развален ред от потока не бива да убива екрана.
      }
    });

    source.addEventListener('timeout', () => {
      setTimedOut(true);
      source.close();
    });

    source.onerror = () => {
      // Не гасим ръчно: браузърът сам опитва пак, а допитването отдолу
      // държи екрана верен междувременно.
    };

    return () => source.close();
  }, [id, done]);

  // ── Предпазното допитване ───────────────────────────────────────────────
  React.useEffect(() => {
    if (done) return undefined;

    let alive = true;
    const ask = async () => {
      try {
        const response = await fetch(`/api/generate/${id}`, { cache: 'no-store' });
        if (!response.ok || !alive) return;
        setView((await response.json()) as GenerationView);
      } catch {
        // Мрежата ще се оправи или няма — броячът продължава да върви.
      }
    };

    void ask();
    const timer = setInterval(() => void ask(), POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [id, done]);

  return { view, elapsed, timedOut, done };
}
