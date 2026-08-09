/**
 * ПОТОКЪТ НА СТАРТОВИЯ ЕКРАН
 *
 * Три стъпки: твоята снимка → дрехата → резултатът. Показват се ЕДНА ПО
 * ЕДНА, в кръг, точно както човек ги прави.
 *
 * ═══ ЗАЩО ЕДНА ПО ЕДНА, А НЕ ТРИТЕ НАВЕДНЪЖ ═══
 *
 * Мострата, по която е правено, е плакат — там трите стъпки стоят една под
 * друга и се разглеждат на спокойствие. На телефон същата подредба иска
 * скролване, а над нея трябва да се съберат логото и двете копчета.
 *
 * По-важното: последователността САМА разказва реда. Три снимки наведнъж
 * са картинка; три снимки, които се сменят с номера, са обяснение.
 *
 * ═══ ЗАЩО РАМКАТА СМЕНЯ ШИРОЧИНАТА, А НЕ ВИСОЧИНАТА ═══
 *
 * Трите снимки са с много различни съотношения — човекът е 2:3, аутфитът е
 * ШИРОК 5:4, скрийншотът е много висок. Едно общо съотношение би отрязало
 * или главата, или половината аутфит.
 *
 * Затова височината е закована, а широчината се мени. Редът не подскача,
 * а всяка снимка се вижда цяла, без рязане и без бели полета.
 *
 * ═══ НАДПИСИТЕ СЕ ПОЯВЯВАТ ПРИ НАТИСКАНЕ ═══
 *
 * По време на въртенето няма текст. Какво прави приложението вече го казват
 * изреченията над потока; трети слой думи върху същия екран е шум.
 *
 * Натисне ли се стъпка, излиза какво се прави на нея — и въртенето СПИРА.
 * Човек, който е поел управлението, не бива да бъде избутван нататък.
 */

'use client';

import * as React from 'react';
import { Patch, type Material } from '@/components/ui/patch';
import { useImageStatus } from '@/lib/use-image-status';
import { cn } from '@/lib/cn';

/** Колко стои всяка стъпка, преди да мине на следващата. */
const STEP_MS = 2800;

/** Височината на сцената. Широчината се мени, тя — не. */
const STAGE = 268;

type Step = {
  n: number;
  label: string;
  /** Материалът на числото — същите, с които е сглобено логото. */
  material: Material;
  /** Тъмен ли е материалът: числото върху него става светло. */
  dark?: boolean;
  shots: { src: string; alt: string; ratio: number }[];
};

const STEPS: Step[] = [
  {
    n: 1,
    label: 'Качи своя снимка',
    material: 'denim',
    dark: true,
    shots: [
      { src: '/flow/1-snimka-720.jpg', alt: 'Снимка на човек в цял ръст', ratio: 1023 / 1537 },
    ],
  },
  {
    n: 2,
    // Двата начина стоят в един ред нарочно: „или" в изречение се пропуска,
    // но когато снимката се смени пред очите ти, се разбира.
    label: 'Избери аутфит или постави линк',
    material: 'knit',
    shots: [
      { src: '/flow/2-drexa-720.jpg', alt: 'Дрехите на подредба', ratio: 1402 / 1122 },
      { src: '/flow/2-skrinshot-720.jpg', alt: 'Скрийншот от магазин', ratio: 853 / 1844 },
    ],
  },
  {
    n: 3,
    label: 'Получи готовия резултат',
    material: 'dots',
    shots: [
      { src: '/flow/3-rezultat-720.jpg', alt: 'Готовата проба', ratio: 1023 / 1537 },
    ],
  },
];

export function FlowPreview() {
  /**
   * ═══ ЕДИН БРОЯЧ, А НЕ ДВЕ СЪСТОЯНИЯ ═══
   *
   * Първо имаше отделни `step` и `variant`, а вторият се сменяше ВЪТРЕ в
   * updater-а на първия. Това е нечисто: React очаква функцията за
   * обновяване да няма странични ефекти, и тихо изяде смяната — стъпката
   * не мърдаше изобщо.
   *
   * Сега брои се едно число, а стъпката и вариантът се ИЗВЕЖДАТ от него.
   * Няма как да се разминат, защото не са две неща.
   */
  const [tick, setTick] = React.useState(0);

  /** Коя стъпка е избрана на ръка. `null` значи, че върви само. */
  const [picked, setPicked] = React.useState<number | null>(null);

  const auto = picked === null;

  React.useEffect(() => {
    if (!auto) return undefined;
    const timer = setInterval(() => setTick((value) => value + 1), STEP_MS);
    return () => clearInterval(timer);
  }, [auto]);

  const step = picked ?? tick % STEPS.length;
  const current = STEPS[step]!;

  // Втората стъпка има два варианта. Сменят се при всяко ново минаване
  // през кръга, за да се видят и двата начина за дрехата.
  const round = Math.floor(tick / STEPS.length);
  const shot = current.shots[round % current.shots.length]!;

  function pick(index: number): void {
    // Второ натискане на същото число връща въртенето.
    setPicked((old) => (old === index ? null : index));
  }

  const revealed = picked;

  return (
    <div className="flex w-full flex-col items-center">
      {/* ── Сцената ────────────────────────────────────────────────────── */}
      <div
        className="relative flex w-full items-center justify-center"
        style={{ height: STAGE }}
      >
        {/* `key` кара React да СМЕНИ елемента, вместо да го обнови — така
            влизащата снимка получава анимацията си отначало. */}
        <Frame key={shot.src} shot={shot} step={current} />
      </div>

      {/* ── Номерата ────────────────────────────────────────────────────
          Те са и показалец докъде сме, и копчета. Едно нещо, два смисъла —
          вместо отделен ред точки, който не се натиска. */}
      <div className="mt-5 flex items-center gap-2.5">
        {STEPS.map((entry, index) => (
          <React.Fragment key={entry.n}>
            {index > 0 && <Arrow lit={step >= index} />}
            <button
              type="button"
              onClick={() => pick(index)}
              aria-label={entry.label}
              aria-current={step === index ? 'step' : undefined}
              className={cn(
                'pressable transition-[opacity,transform] duration-[var(--dur-menu)] ease-[var(--ease-out)]',
                step === index ? 'scale-100 opacity-100' : 'scale-[0.86] opacity-45',
              )}
            >
              <Patch
                material={entry.material}
                tilt={index % 2 ? 3 : -3}
                className={cn(
                  'display grid size-11 place-items-center text-[19px]',
                  entry.dark ? 'text-white' : 'text-ink',
                )}
              >
                {entry.n}
              </Patch>
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* ── Надписът ────────────────────────────────────────────────────
          Мястото е запазено винаги, дори празно. Иначе появата на текста
          избутва копчетата надолу и екранът подскача при всяко натискане. */}
      <div className="mt-3 flex h-9 items-start justify-center px-4">
        {revealed !== null ? (
          <p className="enter-rise text-center text-[15px] font-semibold leading-snug">
            {STEPS[revealed]!.label}
          </p>
        ) : (
          <p className="text-center text-[12.5px] text-ink-25">
            Натисни число, за да видиш какво се прави
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Рамката около снимката.
 *
 * Широчината идва от съотношението на самата снимка, за да няма нито
 * рязане, нито бели полета. Докато файлът го няма, стои пунктирано каре —
 * екранът изглежда недовършен, не счупен.
 */
function Frame({
  shot,
  step,
}: {
  shot: { src: string; alt: string; ratio: number };
  step: Step;
}) {
  const image = useImageStatus();
  const width = Math.round(STAGE * shot.ratio);

  return (
    <div className="enter-pop relative" style={{ height: STAGE, width }}>
      {/* Лаймовият кант е от мострата. Дебел е, защото на светъл фон тънък
          кант около светла снимка просто не се вижда. */}
      <div className="size-full overflow-hidden rounded-[20px_15px_22px_14px] bg-paper-3 ring-[5px] ring-lime">
        {image.failed ? (
          <div className="grid size-full place-items-center border-2 border-dashed border-ink-25 px-2 text-center">
            <span className="text-[11px] leading-tight text-ink-25">
              {shot.src.split('/').pop()}
            </span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={image.ref}
            src={shot.src}
            alt={shot.alt}
            onError={image.onError}
            draggable={false}
            className="size-full object-cover"
          />
        )}
      </div>

      {/* Числото стои ВЪРХУ ъгъла на рамката, наполовина извън нея — така
          се чете като залепено парче, а не като част от снимката.

          ⚠ Позиционирането е на ОБВИВКАТА, не на самото парче. Текстурите
          слагат `position: relative` за наслагването си (шевовете на денима,
          точките) и то бие класа на Tailwind, защото стои по-надолу в
          стиловете. Сложено направо на `Patch`, числото падаше долу — върху
          показалеца — и изглеждаше като втори номер. */}
      <span className="absolute -left-3 -top-3 block">
        <Patch
          material={step.material}
          tilt={-6}
          className={cn(
            'display grid size-12 place-items-center text-[21px]',
            step.dark ? 'text-white' : 'text-ink',
          )}
        >
          {step.n}
        </Patch>
      </span>
    </div>
  );
}

/** Стрелката между номерата. Светва, щом стъпката е минала. */
function Arrow({ lit }: { lit: boolean }) {
  return (
    <svg
      viewBox="0 0 22 12"
      className={cn(
        'h-3 w-5 shrink-0 transition-colors duration-[var(--dur-menu)] ease-[var(--ease-out)]',
        lit ? 'text-violet' : 'text-ink-25',
      )}
      fill="none"
      aria-hidden="true"
    >
      <path d="M2 6.2c5.4-.4 10.8-.4 16.2-.1" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M14.4 2.2c1.4 1.3 2.6 2.7 3.9 4-1.3 1.3-2.6 2.6-3.8 3.8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
