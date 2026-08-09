'use client';

import { Lookbook } from '@/components/lookbook';
import { Patch } from '@/components/ui/patch';
import { Sparks } from '@/components/ui/scribble';
import { useMe } from '@/lib/use-me';

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
 * Свалени са:
 *
 *   „Нова проба"  — стои в средата на долното меню, издигнато и лаймово, на
 *                   всеки екран. Второ копче за същото не добавя път, а
 *                   отнема място на единственото живо съдържание.
 *
 *   Магазините    — списък с имена, който не се натиска и не води никъде.
 *                   Мястото му е при полето за линк, не тук.
 *
 *   Съветите      — три правила за добра снимка. Четат се веднъж и после
 *                   заемат половин екран завинаги. Същото пише и до карето
 *                   за качване, където има значение.
 *
 * Остават балансът — числото, което решава дали изобщо може да се пробва —
 * и Lookbook. Второто е причината приложението да се отвори и в ден, в
 * който няма какво да се пробва.
 */
export default function HomePage() {
  const { me, loading } = useMe();
  const credits = me?.credits ?? 0;
  const tier = me?.tier;

  return (
    <main className="px-5 pt-5">
      {/* ── Балансът ────────────────────────────────────────────────────────

          ═══ ЗАЩО Е НА ЕДИН РЕД ═══

          Беше висока карта: надпис, число 38 пиксела, подчертаване, черта и
          цяла лента за нивото. Заемаше горната трета от екрана, за да каже
          едно число.

          Сега е един ред: числото вляво, нивото вдясно, тънката лента отдолу.
          Числото остава най-едрото нещо — то е причината да се погледне —
          но под него започва Lookbook, а не още от същото. */}
      <Patch material="leather" tilt={-1} className="flex items-center gap-4 px-5 py-3.5">
        {loading ? (
          <div className="skeleton h-8 w-24 rounded-full" />
        ) : (
          <div className="flex items-baseline gap-1.5">
            <span className="display text-[30px] leading-none text-lime">{credits}</span>
            <span className="text-[12.5px] font-semibold text-white/55">
              {credits === 1 ? 'проба' : 'проби'}
            </span>
          </div>
        )}

        {tier && (
          <div className="ml-auto min-w-0 text-right">
            <div className="truncate text-[12.5px] font-semibold text-white/85">
              {tier.vip ? '🔑 VIP Closet' : `${tier.emoji} ${tier.rank}`}
            </div>

            {!tier.vip && (
              <>
                <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-white/12">
                  <div
                    className="h-full rounded-full bg-lime transition-[width] duration-[var(--dur-sheet)] ease-[var(--ease-out)]"
                    style={{ width: `${tier.progressPct}%` }}
                  />
                </div>
                {tier.next && (
                  <div className="mt-1 truncate text-[11px] text-white/40">
                    още {tier.toNext} до {tier.next}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <Sparks className="h-3 w-4 shrink-0 text-lime" />
      </Patch>

      {/* ── Lookbook ────────────────────────────────────────────────────────
          Единственото съдържание на екрана. Затова започва високо и заема
          всичко останало. */}
      <Lookbook />
    </main>
  );
}
