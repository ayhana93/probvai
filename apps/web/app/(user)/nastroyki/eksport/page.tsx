'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { R } from '@/lib/routes';

/**
 * СВАЛЯНЕ НА ДАННИТЕ
 *
 * Право по GDPR, обещано в политиката за поверителност. Екранът е нарочно
 * скучен: тук се идва с въпрос, не за разглеждане.
 */
export default function EksportPage() {
  return (
    <main className="px-5 pt-6">
      <Link
        href={R.settings}
        className="pressable -ml-1 flex size-10 items-center justify-center rounded-full text-ink-45"
        aria-label="Назад"
      >
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </Link>

      <h1 className="display mt-3 text-[26px]">Твоите данни</h1>
      <p className="mt-2 text-[14px] leading-snug text-ink-45">
        Сваля се файл с профила ти, всички проби и историята на кредитите.
      </p>

      <a href="/api/me/danni" download className="mt-6 block">
        <Button variant="action" size="lg" block>
          Свали файла
        </Button>
      </a>

      <p className="mt-4 text-[12.5px] leading-snug text-ink-25">
        Паролата и отговорът на тайния въпрос не влизат във файла — те са
        ключове към профила, не данни за преносимост. Самите снимки също не
        влизат заради размера; свалят се от гардероба.
      </p>
    </main>
  );
}
