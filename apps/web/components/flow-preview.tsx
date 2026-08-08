/**
 * ПОТОКЪТ НА СТАРТОВИЯ ЕКРАН
 *
 * Три стъпки, показани със снимки: твоята снимка → дрехата → резултатът.
 * Заменя трите парчета материал, които стояха тук. Парчетата казваха „плат",
 * но не казваха КАК работи приложението — а точно това е въпросът на човек,
 * който го вижда за първи път.
 *
 * ═══ ВТОРАТА СТЪПКА СЕ СМЕНЯ ═══
 *
 * Дрехата може да дойде по два начина: снимка от магазин или скрийншот от
 * Instagram. Втората плочка ги редува, защото „или" в изречение се пропуска,
 * а смяна пред очите — не.
 *
 * ═══ ЗАЩО РЕЗУЛТАТЪТ Е ПО-ГОЛЯМ ═══
 *
 * Той е наградата. Трите еднакви плочки правят три равностойни стъпки, а те
 * не са равностойни: първите две са работа, третата е причината.
 *
 * ═══ КАКВО СТАВА, ДОКАТО СНИМКИТЕ ГИ НЯМА ═══
 *
 * Стои пунктирано каре с надпис коя снимка липсва. Екранът изглежда
 * недовършен, не счупен — и веднага се вижда кой файл трябва да се качи.
 */

'use client';

import * as React from 'react';
import { Patch } from '@/components/ui/patch';
import { useImageStatus } from '@/lib/use-image-status';
import { cn } from '@/lib/cn';

/** Колко стои всеки от двата варианта на втората стъпка. */
const SWAP_MS = 2600;

type Shot = { src: string; alt: string; label: string };

const PERSON: Shot = {
  src: '/flow/1-snimka.jpg',
  alt: 'Снимка на човек в цял ръст',
  label: '1-snimka.jpg',
};

/** Двата начина да дадеш дрехата. Редуват се. */
const GARMENT: Shot[] = [
  { src: '/flow/2-drexa.jpg', alt: 'Снимка на дреха', label: '2-drexa.jpg' },
  { src: '/flow/2-skrinshot.jpg', alt: 'Скрийншот от магазин', label: '2-skrinshot.jpg' },
];

const RESULT: Shot = {
  src: '/flow/3-rezultat.jpg',
  alt: 'Готовата проба',
  label: '3-rezultat.jpg',
};

/**
 * Една плочка. Пунктирано каре с името на файла, докато снимката я няма —
 * `useImageStatus` хваща и случая, в който файлът връща 404 ПРЕДИ React да
 * се е закачил, когато `onError` вече не се задейства.
 */
function Tile({
  shot,
  className,
  material = 'paper',
  tilt = 0,
}: {
  shot: Shot;
  className?: string;
  material?: 'paper' | 'knit' | 'denim';
  tilt?: number;
}) {
  const image = useImageStatus();

  return (
    <Patch
      material={material}
      className={cn('shrink-0 p-1.5', className)}
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[10px_7px_12px_6px] ring-2 ring-ink">
        {image.failed ? (
          <div className="grid size-full place-items-center border-2 border-dashed border-ink-25 bg-paper-3 px-1 text-center">
            <span className="text-[9px] leading-tight text-ink-25">{shot.label}</span>
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
    </Patch>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="display grid size-5 place-items-center rounded-full bg-ink text-[11px] text-paper">
      {n}
    </span>
  );
}

export function FlowPreview() {
  const [which, setWhich] = React.useState(0);

  // Редуването е с таймер, а не с CSS анимация: двете снимки са различни
  // файлове и трябва да се сменят в DOM, не да се разкриват.
  React.useEffect(() => {
    const timer = setInterval(() => setWhich((value) => (value + 1) % GARMENT.length), SWAP_MS);
    return () => clearInterval(timer);
  }, []);

  const garment = GARMENT[which]!;

  return (
    <div className="flex items-center justify-center gap-1.5">
      {/* ── 1. Твоята снимка ─────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-2">
        <Tile shot={PERSON} material="denim" tilt={-3} className="w-[86px]" />
        <Step n={1} />
      </div>

      <Plus />

      {/* ── 2. Дрехата — снимка ИЛИ скрийншот ────────────────────────────── */}
      <div className="flex flex-col items-center gap-2">
        {/* `key` кара React да смени елемента, а не да го обнови — така
            влизащата снимка получава анимацията си отначало. */}
        <div key={garment.src} className="enter-pop">
          <Tile shot={garment} material="paper" tilt={2.5} className="w-[86px]" />
        </div>
        <Step n={2} />
      </div>

      <Arrow />

      {/* ── 3. Резултатът ───────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-2">
        <Tile shot={RESULT} material="knit" tilt={-2} className="w-[108px]" />
        <Step n={3} />
      </div>
    </div>
  );
}

function Plus() {
  return (
    <svg viewBox="0 0 20 20" className="mb-7 size-4 shrink-0 text-ink-45" aria-hidden="true">
      <path
        d="M10 4.2v11.4M4.3 10h11.4"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 20" className="mb-7 size-5 shrink-0 text-violet" aria-hidden="true" fill="none">
      <path
        d="M3.5 10.2c5.6-.4 11.2-.4 16.8-.1"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M15.6 5.4c1.6 1.6 3.1 3.2 4.7 4.7-1.6 1.6-3.1 3.1-4.6 4.6"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
