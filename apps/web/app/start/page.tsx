import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Logo } from '@/components/logo';
import { FlowPreview } from '@/components/flow-preview';
import { R } from '@/lib/routes';

/**
 * СТАРТОВИЯТ ЕКРАН
 *
 * Първото, което вижда човек без профил. Има точно три задачи и нито една
 * повече: да покаже кои сме, да каже за какво става дума с едно изречение,
 * и да отведе към вход или регистрация.
 *
 * ═══ ЗАЩО ТУК ИМА АНИМАЦИЯ, А В МЕНЮТО НЯМА ═══
 *
 * Правилото не е „анимациите са хубави" и не е „анимациите бавят". То е:
 * колко често се вижда това. Менюто се натиска по десетки пъти на ден —
 * там всяко движение става бавене. Този екран се вижда веднъж, при първото
 * отваряне. Точно тогава си струва да оставим впечатление.
 *
 * ═══ КАКВО СЕ ПОКАЗВА ═══
 *
 * Самият поток: твоята снимка → дрехата → резултатът. Преди тук стояха три
 * парчета материал. Те бяха красиви и не отговаряха на въпроса, който всеки
 * си задава на този екран — а той е „какво точно прави това".
 *
 * Втората стъпка се редува между снимка на дреха и скрийншот, защото
 * дрехата може да дойде по два начина. „Или" в изречение се пропуска;
 * смяна пред очите — не.
 *
 * Изреченията се сменят с размиване. Без него се виждат два текста
 * едновременно и окото ги хваща като два обекта, които се застъпват.
 *
 * Всичко е на CSS, не на JavaScript: този екран се гледа точно докато
 * страницата още се зарежда, а CSS анимациите вървят извън главната нишка
 * и не изпускат кадри тогава.
 */

/** Какво прави приложението, на три завъртания. */
const PHRASES = [
  'Виж как ти стои дрехата, преди да я поръчаш.',
  'Качваш своя снимка и снимка на дрехата. Толкова.',
  'Или само линк от магазина — снимката се взима сама.',
];

export default async function StartPage() {
  // Влезлият човек няма работа тук. Стартовият екран пред него е стъпка
  // назад, а не начало.
  const session = await auth();
  if (session?.user?.id) redirect('/');

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(48px,calc(env(safe-area-inset-top)+24px))]">
      {/* ── Логото ─────────────────────────────────────────────────────── */}
      <div className="enter-rise flex justify-center">
        <Logo width={252} priority />
      </div>

      {/* ── Какво прави приложението ────────────────────────────────────
          Трите изречения се въртят на едно и също място. Височината е
          закована, за да не подскача екранът при по-дълго изречение. */}
      <div className="relative mt-5 h-[52px]">
        {PHRASES.map((phrase, index) => (
          <p
            key={phrase}
            className="phrase absolute inset-0 text-center text-[15.5px] leading-snug text-ink-70"
            style={{ animationDelay: `${index * 3}s` }}
          >
            {phrase}
          </p>
        ))}
      </div>

      {/* ── Потокът ─────────────────────────────────────────────────────── */}
      <div className="relative mt-8 flex flex-1 flex-col items-center justify-center">
        <FlowPreview />

        {/* Маркерният щрих отдолу се тегли, а не се появява. */}
        <svg
          viewBox="0 0 200 20"
          className="mt-6 h-5 w-52 text-violet"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M6 13c28-7 58-9 92-6 30 2 62 1 96-4"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            className="draw-stroke"
            style={{ '--len': 210 } as React.CSSProperties}
          />
        </svg>
      </div>

      {/* ── Изходите ────────────────────────────────────────────────────
          „Създай акаунт" е главното и е лаймово: човек, стигнал дотук, в
          повечето случаи още няма профил. „Влез" е тихо отдолу — който го
          търси, го намира веднага. */}
      <div className="stagger mt-10 space-y-2.5">
        <Link
          href={R.register}
          className="pressable flex h-14 w-full items-center justify-center rounded-full bg-lime shadow-[0_3px_0_var(--color-lime-deep)] active:shadow-[0_1px_0_var(--color-lime-deep)]"
        >
          <span className="display text-[17px] text-ink">Създай акаунт</span>
        </Link>

        <Link
          href={R.login}
          className="pressable flex h-14 w-full items-center justify-center rounded-full bg-paper-2 text-[15px] font-semibold"
        >
          Вече имам профил
        </Link>
      </div>

      <p className="mt-5 text-center text-[12px] leading-relaxed text-ink-25">
        С влизането приемаш{' '}
        <a href={R.terms} className="underline underline-offset-2">
          Условията
        </a>{' '}
        и{' '}
        <a href={R.privacy} className="underline underline-offset-2">
          Политиката за поверителност
        </a>
        .
      </p>
    </main>
  );
}
