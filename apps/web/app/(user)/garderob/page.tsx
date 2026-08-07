import Link from 'next/link';
import { Mascot } from '@/components/mascot';
import { Patch } from '@/components/ui/patch';
import { Zigzag } from '@/components/ui/scribble';

/**
 * ГАРДЕРОБ
 *
 * Две колони, ленив зареждане. Всички гардероби са частни — няма публичен
 * режим и няма чужди профили.
 *
 * Празното състояние не е съобщение за грешка. То е покана и е единственото
 * място, където героят е голям.
 */

const ITEMS = [
  { id: 1, merchant: 'Shein', watermarked: true },
  { id: 2, merchant: 'Vinted', watermarked: true },
  { id: 3, merchant: 'Zalando', watermarked: false },
  { id: 4, merchant: null, watermarked: false },
];

export default function GarderobPage() {
  const empty = ITEMS.length === 0;

  if (empty) {
    return (
      <main className="flex min-h-[70dvh] flex-col items-center justify-center px-8 text-center">
        <Mascot credits={0} size={120} />
        <h1 className="display mt-6 text-[24px]">Още е празно</h1>
        <p className="mt-2 max-w-[260px] text-[14px] leading-snug text-ink-45">
          Първата ти проба ще се появи тук. Гардеробът е само твой — никой друг
          не го вижда.
        </p>
        <Link
          href="/proba"
          className="pressable mt-6 inline-flex h-13 items-center rounded-full bg-lime px-7 py-3.5 shadow-[0_3px_0_var(--color-lime-deep)]"
        >
          <span className="display text-[16px]">Пробвай нещо</span>
        </Link>
      </main>
    );
  }

  return (
    <main className="px-5 pt-6">
      <div className="flex items-end justify-between">
        <h1 className="display text-[28px]">Гардероб</h1>
        <Zigzag className="mb-2 h-4 w-14 text-ink/20" />
      </div>
      <p className="mt-2 text-[14px] text-ink-45">
        {ITEMS.length} проби · само твои
      </p>

      <ul className="stagger mt-5 grid grid-cols-2 gap-3">
        {ITEMS.map((item) => (
          <li key={item.id}>
            <Patch
              material="paper"
              className="relative aspect-[3/4] overflow-hidden"
            >
              <div className="skeleton size-full" />

              {item.merchant && (
                <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-1 text-[10.5px] font-semibold text-paper backdrop-blur-sm">
                  {item.merchant}
                </span>
              )}

              {item.watermarked && (
                <span className="absolute bottom-2 right-2 rounded-full bg-violet px-2 py-1 text-[10.5px] font-semibold text-white">
                  воден знак
                </span>
              )}
            </Patch>
          </li>
        ))}
      </ul>
    </main>
  );
}
