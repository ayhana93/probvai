import Link from 'next/link';
import { env } from '@probvai/core';
import { HomeBalance } from '@/components/home-balance';
import { Lookbook } from '@/components/lookbook';
import { Patch } from '@/components/ui/patch';
import { Sparks, Zigzag } from '@/components/ui/scribble';
import { R } from '@/lib/routes';

export const dynamic = 'force-dynamic';

/**
 * НАЧАЛО
 *
 * ═══ ЕДИН ЕКРАН, ЕДНО НЕЩО ═══
 *
 * Тук имаше пет секции: баланс, голямо копче „Нова проба", Lookbook, списък
 * с магазини и съвети за по-добра снимка. Всяка поотделно беше защитима, а
 * заедно правеха началния екран каталог от възможности — човек го отваряше и
 * му трябваше решение, преди да види каквото и да е.
 *
 * Останаха балансът — числото, което решава дали изобщо може да се пробва —
 * и по едно нещо под него.
 *
 * ═══ ЗАЩО СЪДЪРЖАНИЕТО СЕ СМЕНЯ ═══
 *
 * Докато галерията се показва, тя е причината приложението да се отвори и в
 * ден, в който няма какво да се пробва. Скрие ли се, под баланса остава дупка
 * — и точно тогава трите стъпки си заслужават мястото.
 *
 * Същият текст беше свален оттук преди, защото до пълна галерия беше шум.
 * Съдържание не е добро или лошо само по себе си: зависи какво стои до него.
 *
 * ═══ ЗАЩО РЕШЕНИЕТО Е НА СЪРВЪРА ═══
 *
 * Ключът е стойност от средата и се знае, преди страницата да тръгне към
 * браузъра. Питан от браузъра, той щеше да значи първо едно нещо на екрана,
 * после друго — а човекът вижда пренареждането.
 */
export default function HomePage() {
  return (
    <main className="px-5 pt-5">
      <HomeBalance />

      {env.LOOKBOOK_ENABLED ? <Lookbook /> : <StartHere />}
    </main>
  );
}

/**
 * ТРИТЕ СТЪПКИ.
 *
 * Не е копче — копчето „Нова проба" стои издигнато в средата на долното меню
 * на всеки екран и второ за същото не добавя път. Това обяснява КАКВО ще се
 * случи, когато се натисне то, и затова свършва с връзка, а не с призив.
 */
function StartHere() {
  const steps = [
    { n: 1, title: 'Снимка на теб', note: 'Цял ръст, права стойка, добра светлина.' },
    { n: 2, title: 'Снимка на дрехата', note: 'От магазин или от твоя гардероб.' },
    { n: 3, title: 'Готово', note: 'Пробата влиза в гардероба ти.' },
  ];

  return (
    <section className="mt-7">
      <div className="flex items-end justify-between gap-3">
        <h2 className="display shrink-0 text-[22px]">Как става</h2>
        <Zigzag className="mb-1.5 h-4 w-14 text-ink/20" />
      </div>

      <ol className="stagger mt-4 space-y-2.5">
        {steps.map((step) => (
          <li key={step.n}>
            <Patch material="paper" className="flex items-center gap-4 px-4 py-3.5">
              <span
                aria-hidden="true"
                className="display grid size-9 shrink-0 place-items-center rounded-full bg-lime text-[15px] text-ink"
              >
                {step.n}
              </span>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold">{step.title}</div>
                <div className="mt-0.5 text-[13px] leading-snug text-ink-45">
                  {step.note}
                </div>
              </div>
            </Patch>
          </li>
        ))}
      </ol>

      <Link
        href={R.tryOn}
        className="pressable mt-5 flex items-center justify-center gap-2 rounded-full bg-lime px-7 py-3.5 shadow-[0_3px_0_var(--color-lime-deep)]"
      >
        <Sparks className="h-3.5 w-5 text-ink" />
        <span className="display text-[16px]">Пробвай нещо</span>
      </Link>
    </section>
  );
}
