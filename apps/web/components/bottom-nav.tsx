/**
 * ДОЛНОТО МЕНЮ
 *
 * Плаващо, тъмно, с издигнат център.
 *
 * ═══ ЗАЩО ТУК НЯМА АНИМАЦИЯ НА ПРЕХОДА МЕЖДУ ТАБОВЕТЕ ═══
 *
 * Менюто се натиска десетки пъти на ден. Анимация, която се вижда толкова
 * често, спира да е приятна и започва да е бавене. Затова: нула преходи,
 * нула въртене на празен ход. Остава само `scale` при натискане — това е
 * обратна връзка, не украса.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CreditsIcon,
  HomeIcon,
  SettingsIcon,
  WardrobeIcon,
} from '@/components/ui/nav-icons';
import { cn } from '@/lib/cn';
import { R } from '@/lib/routes';

type Item = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const LEFT: Item[] = [
  { href: '/', label: 'Начало', Icon: HomeIcon },
  { href: R.wardrobe, label: 'Гардероб', Icon: WardrobeIcon },
];

const RIGHT: Item[] = [
  { href: R.credits, label: 'Проби', Icon: CreditsIcon },
  { href: R.settings, label: 'Настройки', Icon: SettingsIcon },
];

/**
 * ═══ ЗАЩО ТОЧКАТА Е ИЗВАДЕНА ОТ ПОТОКА ═══
 *
 * Беше под иконата, в същата колона. Тогава центрира се целият стълб
 * „икона + точка", а не иконата — и всяка икона стоеше с 4 пиксела по-нагоре
 * от центъра на кутията си. На един ред от четири това се събира и редът
 * изглежда качен нагоре, без да си личи защо.
 *
 * Сега иконата е центрирана в квадрата, а точката е закачена отдолу.
 * Иконата седи там, където окото я търси, а точката не мести нищо.
 */
function NavLink({ item, active }: { item: Item; active: boolean }) {
  const { Icon } = item;

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'pressable relative grid size-12 place-items-center rounded-2xl',
        active ? 'text-lime' : 'text-white/50',
      )}
    >
      <Icon />
      <span className="sr-only">{item.label}</span>
      <span
        aria-hidden="true"
        className={cn(
          'absolute bottom-1 size-1 rounded-full',
          active ? 'bg-lime' : 'bg-transparent',
        )}
      />
    </Link>
  );
}

/**
 * ЦЕНТРАЛНОТО КОПЧЕ
 *
 * Главното действие на цялото приложение. Три решения:
 *
 * 1. НЕ Е КРЪГ. Кръгът е това, което прави всяко приложение. Тук е парче
 *    с неравни ъгли и лек наклон — същата форма, с която е сглобено
 *    логото. Знакът вътре е изправен: наклонена е подложката, не плюсът,
 *    защото крив плюс се чете като грешка.
 *
 * 2. ДЕБЕЛ ТЪМЕН ПРЪСТЕН. Копчето седи върху тъмната лента и наполовина
 *    излиза от нея. Без пръстена лаймът се слива с ръба на лентата и
 *    формата се губи.
 *
 * 3. НУЛА ДВИЖЕНИЕ НА ПРАЗЕН ХОД. Пулсиращо копче в менюто, което се
 *    гледа по цял ден, спира да привлича и започва да дразни. Изпъква с
 *    цвят, размер и височина — не с мърдане.
 */
function NewTryButton({ active }: { active: boolean }) {
  return (
    <Link
      href={R.tryOn}
      aria-label="Нова проба"
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group absolute left-1/2 top-1/2 grid size-[72px] -translate-x-1/2 -translate-y-1/2',
        'place-items-center rounded-full',
        'transition-transform duration-[var(--dur-press)] ease-[var(--ease-out)]',
        'active:scale-[0.94]',
      )}
    >
      {/* Подложката: наклонено парче плетка с тъмен пръстен. */}
      <span
        aria-hidden="true"
        className={cn(
          'tx-knit absolute inset-0 -rotate-3',
          'rounded-[24px_18px_26px_16px]',
          'ring-[5px] ring-ink',
          'shadow-[0_5px_0_var(--color-lime-deep),0_10px_20px_-8px_rgba(0,0,0,.7)]',
          'transition-shadow duration-[var(--dur-press)] ease-[var(--ease-out)]',
          'group-active:shadow-[0_2px_0_var(--color-lime-deep),0_5px_12px_-8px_rgba(0,0,0,.7)]',
        )}
      />

      {/* Знакът: прав, дебел, с маркерни щрихи в единия ъгъл — ръката от
          логото, но в най-малката възможна доза. */}
      <svg viewBox="0 0 44 44" className="relative size-[38px] text-ink" aria-hidden="true">
        <path
          d="M22 12v20M12 22h20"
          stroke="currentColor"
          strokeWidth="5.5"
          strokeLinecap="round"
        />
        <path
          d="M33 8.5 35.5 4M37.5 12l4-2.5"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.55"
        />
      </svg>
    </Link>
  );
}

/**
 * `standalone` е за демо страницата: там менюто трябва да седи в потока,
 * а не да се залепва за дъното на екрана. Един източник на истината е
 * по-добре от втори екземпляр, който после се разминава с истинския.
 */
export function BottomNav({ standalone }: { standalone?: boolean } = {}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={standalone ? 'Основно меню (мостра)' : 'Основно меню'}
      className={cn(
        'mx-auto w-full max-w-[430px] px-4',
        standalone
          ? 'relative pb-4 pt-5'
          : 'fixed inset-x-0 bottom-0 z-40 pb-[max(14px,env(safe-area-inset-bottom))]',
      )}
    >
      {/* ═══ ЗАЩО ТРИТЕ ЧАСТИ СА С РАВНА ТЕЖЕСТ ═══
          Преди беше `justify-between` с празнина по средата. Тогава
          разстоянията се смятаха от ширината на групите, а те се менят с
          големината на иконите — всяка промяна на иконите разместваше реда.
          Сега двете двойки и дупката делят лентата на три равни части, а
          копчето седи точно в средната. */}
      <div className="relative flex h-[64px] items-center rounded-[26px] bg-ink px-3 shadow-[0_10px_34px_-10px_rgba(20,20,22,.65)]">
        <div className="flex flex-1 justify-around">
          {LEFT.map((item) => (
            <NavLink key={item.href} item={item} active={pathname === item.href} />
          ))}
        </div>

        {/* Дупка в лентата, за да седне копчето в нея. */}
        <div className="w-[84px] shrink-0" aria-hidden="true" />

        <div className="flex flex-1 justify-around">
          {RIGHT.map((item) => (
            <NavLink key={item.href} item={item} active={pathname === item.href} />
          ))}
        </div>

        <NewTryButton active={pathname === R.tryOn} />
      </div>
    </nav>
  );
}
