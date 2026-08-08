'use client';

import Link from 'next/link';
import { Lookbook } from '@/components/lookbook';
import { Patch, PatchHeading } from '@/components/ui/patch';
import { Sparks, Underscribble, Zigzag } from '@/components/ui/scribble';
import { ArrowRightIcon } from '@/components/ui/icons';
import { useMe } from '@/lib/use-me';
import { R } from '@/lib/routes';

/**
 * НАЧАЛО
 *
 * ═══ ТУК НЯМА ЛОГО ═══
 *
 * Логото стои на входа и толкова. Началният екран се отваря по няколко пъти
 * на ден от човек, който вече знае кое е приложението — марка, показана на
 * някой, който я знае, не казва нищо и заема най-скъпото място на екрана.
 *
 * Затова първото нещо е БАЛАНСЪТ. Той е единственото, което решава дали
 * изобщо може да се пробва нещо, и е причината човек да погледне екрана.
 *
 * Отдолу е Lookbook: чужди визии, които показват какво може да се направи.
 * Това е причината приложението да се отвори и в ден, в който няма какво
 * да се пробва.
 */

const SHOPS = [
  { name: 'Shein', material: 'dots' as const, tilt: -2 },
  { name: 'Vinted', material: 'knit' as const, tilt: 1.5 },
  { name: 'Zalando', material: 'denim' as const, tilt: -1 },
  { name: 'Answear', material: 'felt' as const, tilt: 2 },
  { name: 'About You', material: 'foil' as const, tilt: -1.5 },
  { name: 'eMAG', material: 'leather' as const, tilt: 1 },
];

const TIPS = [
  { title: 'Цял ръст', body: 'Или поне до коленете. Колкото повече от теб се вижда, толкова по-вярно излиза.' },
  { title: 'Права стойка', body: 'Ръцете свободно до тялото, без да закриват дрехата.' },
  { title: 'Дневна светлина', body: 'До прозорец. Без сенки върху лицето.' },
];

export default function HomePage() {
  const { me, loading } = useMe();
  const credits = me?.credits ?? 0;
  const tier = me?.tier;

  return (
    <main className="px-5 pt-5">
      {/* ── Балансът ────────────────────────────────────────────────────────
          Първото нещо на екрана. Заема целия ред; числото е единственото,
          което трябва да се прочете оттук. */}
      <section>
        <Patch material="leather" tilt={-1.5} className="px-5 py-4">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
            Твоят баланс
            <Sparks className="h-3 w-4 text-lime" />
          </div>

          {loading ? (
            <div className="skeleton mt-2 h-9 w-28 rounded-full" />
          ) : (
            <div className="display mt-1 flex items-baseline gap-2 text-[38px] text-lime">
              {credits}
              <span className="text-[13px] font-semibold normal-case tracking-normal text-white/60">
                {credits === 1 ? 'проба' : 'проби'}
              </span>
            </div>
          )}
          <Underscribble className="mt-0.5 h-2.5 w-24 text-lime/60" />

          {/* ── Нивото ────────────────────────────────────────────────────
              Стои тук, а не на отделен екран: постижение, което трябва да
              се търси, не е постижение. */}
          {tier && (
            <div className="mt-4 border-t border-white/10 pt-3">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-semibold text-white/85">
                  {tier.vip ? '🔑 VIP Closet' : `${tier.emoji} ${tier.rank}`}
                </span>
                <span className="text-[11.5px] text-white/45">
                  {tier.vip
                    ? 'HD · значка · с предимство'
                    : tier.next
                      ? `още ${tier.toNext} до ${tier.next}`
                      : `${tier.xp} точки`}
                </span>
              </div>

              {!tier.vip && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/12">
                  <div
                    className="h-full rounded-full bg-lime transition-[width] duration-[var(--dur-sheet)] ease-[var(--ease-out)]"
                    style={{ width: `${tier.progressPct}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </Patch>
      </section>

      {/* ── Главното действие ─────────────────────────────────────────────── */}
      <Link
        href={R.tryOn}
        className="pressable mt-5 flex h-16 w-full items-center justify-between rounded-full bg-lime px-6 shadow-[0_3px_0_var(--color-lime-deep)] active:shadow-[0_1px_0_var(--color-lime-deep)]"
      >
        <span className="display text-[19px] text-ink">Нова проба</span>
        <ArrowRightIcon className="text-ink" />
      </Link>

      {/* ── Lookbook ──────────────────────────────────────────────────────── */}
      <Lookbook />

      {/* ── Магазините ────────────────────────────────────────────────────── */}
      <section className="mt-9">
        <div className="flex items-end justify-between">
          <PatchHeading words={[{ text: 'Магазини', material: 'knit', tilt: -1.5 }]} />
          <Zigzag className="mb-1 h-4 w-14 text-ink/25" />
        </div>
        <p className="mt-2 text-[14px] leading-snug text-ink-45">
          Постави линк от тези и снимката се взима сама.
        </p>

        <ul className="stagger mt-4 flex flex-wrap gap-2">
          {SHOPS.map((shop) => (
            <Patch
              key={shop.name}
              as="li"
              material={shop.material}
              tilt={shop.tilt}
              className="px-3.5 py-2 text-[13px] font-semibold"
            >
              {shop.name}
            </Patch>
          ))}
        </ul>
      </section>

      {/* ── Съветите ──────────────────────────────────────────────────────── */}
      <section className="mt-9">
        <PatchHeading words={[{ text: 'По-добра', material: 'foil', tilt: 1 }, { text: 'снимка', material: 'dots', tilt: -2 }]} />

        <ul className="stagger mt-4 space-y-2.5">
          {TIPS.map((tip, i) => (
            <li key={tip.title} className="flex gap-3.5 rounded-[var(--radius-card)] bg-paper-2 p-4">
              <span className="display grid size-8 shrink-0 place-items-center rounded-full bg-ink text-[15px] text-lime">
                {i + 1}
              </span>
              <div>
                <div className="text-[15px] font-semibold">{tip.title}</div>
                <p className="mt-0.5 text-[13.5px] leading-snug text-ink-45">{tip.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
