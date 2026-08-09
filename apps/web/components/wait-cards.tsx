/**
 * КАКВО СЕ ВИЖДА, ДОКАТО СЕ ЧАКА
 *
 * ═══ ПРАЗЕН ЕКРАН ЗА ЧАКАНЕ Е ХАБЕНЕ ═══
 *
 * Тридесет секунди по няколко пъти на ден са единственото време, в което
 * човек гледа приложението, без да прави нищо. Празният екран го кара да
 * излезе; пълният го задържа и понякога носи клик към магазин.
 *
 * ═══ ЗАЩО ВСЯКА ВТОРА КАРТА Е СЪВЕТ, А НЕ ОФЕРТА ═══
 *
 * Екран, на който всичко е реклама, се научава да се пропуска с очи за два
 * дни — и после нищо от него не работи, включително офертите. Съветите
 * купуват вниманието, което офертите харчат.
 *
 * Скелетът на бъдещата снимка остава най-отгоре: той е обещанието, заради
 * което човекът чака. Картите са отдолу, не вместо него.
 */

'use client';

import * as React from 'react';
import { Patch } from '@/components/ui/patch';
import type { WaitCardView } from '@/lib/use-generation';

export function WaitCards({ cards }: { cards: WaitCardView[] }) {
  if (cards.length === 0) return null;

  return (
    <section className="mt-7">
      <h2 className="display text-[17px] text-ink-45">Докато чакаш</h2>

      <ul className="stagger mt-3 space-y-2.5">
        {cards.map((card) => {
          const body = (
            <>
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-45">
                {card.tag}
              </span>
              <div className="mt-1 text-[15px] font-semibold leading-tight">
                {card.title}
              </div>
              <p className="mt-1 text-[13px] leading-snug text-ink-45">{card.body}</p>
            </>
          );

          return (
            <li key={card.id}>
              {card.url ? (
                <a
                  href={card.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow sponsored"
                  className="pressable block"
                >
                  <Patch material="paper" className="flex items-center justify-between px-4 py-3.5">
                    <span className="block">{body}</span>
                    <span aria-hidden="true" className="ml-3 shrink-0 text-[15px] text-ink-45">
                      ›
                    </span>
                  </Patch>
                </a>
              ) : (
                <Patch material="paper" className="px-4 py-3.5">
                  {body}
                </Patch>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
