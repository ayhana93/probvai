/**
 * БАЛАНСЪТ НА НАЧАЛНИЯ ЕКРАН
 *
 * ═══ ЗАЩО Е ОТДЕЛЕН ФАЙЛ ═══
 *
 * Началният екран трябва да знае дали Lookbook се показва, а това е решение
 * на СЪРВЪРА — стойност от средата. Балансът пък иска профила на човека,
 * тоест браузър.
 *
 * Ако двете стоят в един компонент, целият екран става клиентски и въпросът
 * „показва ли се галерията" тръгва по мрежата: първо се рисува нещо, после
 * пристига отговорът и екранът се пренарежда пред очите. Разделени, всяко е
 * там, където му е мястото — и нищо не подскача.
 *
 * ═══ ЗАЩО Е НА ЕДИН РЕД ═══
 *
 * Беше висока карта: надпис, число 38 пиксела, подчертаване, черта и цяла
 * лента за нивото. Заемаше горната трета от екрана, за да каже едно число.
 *
 * Сега е един ред: числото вляво, нивото вдясно, тънката лента отдолу.
 * Числото остава най-едрото нещо — то е причината да се погледне — но под
 * него започва съдържанието, а не още от същото.
 */

'use client';

import { Patch } from '@/components/ui/patch';
import { Sparks } from '@/components/ui/scribble';
import { useMe } from '@/lib/use-me';

export function HomeBalance() {
  const { me, loading } = useMe();
  const credits = me?.credits ?? 0;
  const tier = me?.tier;

  return (
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
  );
}
