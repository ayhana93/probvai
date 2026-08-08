import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Logo } from '@/components/logo';
import { Patch } from '@/components/ui/patch';

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
 * ═══ КАКВО СЕ ДВИЖИ ═══
 *
 * Парчетата материал плуват по осем пиксела нагоре-надолу. Не за украса —
 * те са това, от което е сглобено логото, и движението им казва „тук се
 * работи с дрехи", преди човек да е прочел и дума.
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

/** Материалите от логото. Наклонът и закъснението са различни за всяко —
 *  еднакви стойности карат трите да плуват в такт и издават анимацията.
 *
 *  Средното НЕ е лаймово нарочно. Лаймът е цветът на действието и на този
 *  екран той принадлежи на „Създай акаунт". Голямо лаймово петно над
 *  копчето краде точно вниманието, което копчето трябва да получи. */
const PATCHES = [
  { material: 'denim' as const, tilt: -4, delay: '0ms', className: 'h-24 w-20' },
  { material: 'dots' as const, tilt: 3, delay: '700ms', className: 'h-32 w-24' },
  { material: 'foil' as const, tilt: -2, delay: '1400ms', className: 'h-24 w-20' },
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

      {/* ── Материалите ─────────────────────────────────────────────────
          Не са снимки на дрехи нарочно: снимка на конкретна дреха обещава
          точно нея. Парчетата казват „плат", без да обещават нищо. */}
      <div
        aria-hidden="true"
        className="relative mt-9 flex flex-1 items-center justify-center gap-3"
      >
        {PATCHES.map((patch) => (
          <Patch
            key={patch.material}
            material={patch.material}
            className={`float-patch ${patch.className}`}
            style={
              {
                '--tilt': `${patch.tilt}deg`,
                animationDelay: patch.delay,
                transform: `rotate(${patch.tilt}deg)`,
              } as React.CSSProperties
            }
          />
        ))}

        {/* Маркерният щрих отдолу се тегли, а не се появява. */}
        <svg
          viewBox="0 0 200 20"
          className="absolute -bottom-2 h-5 w-52 text-violet"
          fill="none"
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
          href="/registraciya"
          className="pressable flex h-14 w-full items-center justify-center rounded-full bg-lime shadow-[0_3px_0_var(--color-lime-deep)] active:shadow-[0_1px_0_var(--color-lime-deep)]"
        >
          <span className="display text-[17px] text-ink">Създай акаунт</span>
        </Link>

        <Link
          href="/vhod"
          className="pressable flex h-14 w-full items-center justify-center rounded-full bg-paper-2 text-[15px] font-semibold"
        >
          Вече имам профил
        </Link>
      </div>

      <p className="mt-5 text-center text-[12px] leading-relaxed text-ink-25">
        С влизането приемаш{' '}
        <a href="/usloviya" className="underline underline-offset-2">
          Условията
        </a>{' '}
        и{' '}
        <a href="/poveritelnost" className="underline underline-offset-2">
          Политиката за поверителност
        </a>
        .
      </p>
    </main>
  );
}
