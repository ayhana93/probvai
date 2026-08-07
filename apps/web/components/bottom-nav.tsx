/**
 * ДОЛНОТО МЕНЮ
 *
 * Плаващо, тъмно, с издигнат център. Героят е бутонът за нова проба —
 * менюто и героят са едно нещо, не две.
 *
 * ═══ ЗАЩО ТУК НЯМА АНИМАЦИЯ НА ПРЕХОДА МЕЖДУ ТАБОВЕТЕ ═══
 *
 * Менюто се натиска десетки пъти на ден. Анимация, която се вижда толкова
 * често, спира да е приятна и започва да е бавене. Остава само
 * `scale(0.97)` при натискане — обратна връзка, не украса.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Mascot, type MascotState } from '@/components/mascot';
import { cn } from '@/lib/cn';

type Item = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const HomeIcon = (
  <svg viewBox="0 0 24 24" className="size-[22px]" {...stroke}>
    <path d="M4 11.5 12 4l8 7.5" />
    <path d="M6.5 10.5V20h11v-9.5" />
  </svg>
);

const WardrobeIcon = (
  <svg viewBox="0 0 24 24" className="size-[22px]" {...stroke}>
    <rect x="4" y="4" width="7" height="7" rx="2" />
    <rect x="13" y="4" width="7" height="7" rx="2" />
    <rect x="4" y="13" width="7" height="7" rx="2" />
    <rect x="13" y="13" width="7" height="7" rx="2" />
  </svg>
);

const CreditsIcon = (
  <svg viewBox="0 0 24 24" className="size-[22px]" {...stroke}>
    <path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z" />
  </svg>
);

const SettingsIcon = (
  <svg viewBox="0 0 24 24" className="size-[22px]" {...stroke}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2.2" />
    <circle cx="10" cy="17" r="2.2" />
  </svg>
);

const LEFT: Item[] = [
  { href: '/', label: 'Начало', icon: HomeIcon },
  { href: '/garderob', label: 'Гардероб', icon: WardrobeIcon },
];

const RIGHT: Item[] = [
  { href: '/krediti', label: 'Кредити', icon: CreditsIcon },
  { href: '/nastroyki', label: 'Настройки', icon: SettingsIcon },
];

function NavLink({ item, active }: { item: Item; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'pressable flex size-11 flex-col items-center justify-center rounded-2xl',
        active ? 'text-lime' : 'text-white/45',
      )}
    >
      {item.icon}
      <span className="sr-only">{item.label}</span>
      {/* Точката казва къде си, без да мести иконата. */}
      <span
        className={cn(
          'mt-1 block size-1 rounded-full transition-opacity duration-[var(--dur-menu)] ease-[var(--ease-out)]',
          active ? 'bg-lime opacity-100' : 'opacity-0',
        )}
      />
    </Link>
  );
}

export function BottomNav({
  credits,
  state = 'idle',
  daysSinceLastUse = 0,
}: {
  credits: number;
  state?: MascotState;
  daysSinceLastUse?: number;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Основно меню"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[430px] px-4 pb-[max(14px,env(safe-area-inset-bottom))]"
    >
      <div className="relative flex h-[62px] items-center justify-between rounded-[26px] bg-ink px-5 shadow-[0_10px_34px_-10px_rgba(20,20,22,.65)]">
        <div className="flex gap-2">
          {LEFT.map((item) => (
            <NavLink key={item.href} item={item} active={pathname === item.href} />
          ))}
        </div>

        {/* Дупка в лентата, за да седне героят в нея. */}
        <div className="w-[76px]" aria-hidden="true" />

        <div className="flex gap-2">
          {RIGHT.map((item) => (
            <NavLink key={item.href} item={item} active={pathname === item.href} />
          ))}
        </div>

        <Link
          href="/proba"
          aria-label="Нова проба"
          className={cn(
            'pressable absolute left-1/2 top-1/2 grid size-[72px] -translate-x-1/2 -translate-y-1/2 place-items-center',
            'rounded-full bg-paper ring-[5px] ring-ink',
            'shadow-[0_6px_18px_-6px_rgba(20,20,22,.6)]',
          )}
        >
          <Mascot
            credits={credits}
            state={state}
            daysSinceLastUse={daysSinceLastUse}
            size={54}
          />
        </Link>
      </div>
    </nav>
  );
}
