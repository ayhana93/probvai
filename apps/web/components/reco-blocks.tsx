/**
 * ПРЕДЛОЖЕНИЯТА ПОД ВИЗИЯТА
 *
 * Показват се СЛЕД снимката, не преди и не до нея. Първо наградата, после
 * офертата — обратният ред превръща резултата в реклама и хората спират да
 * скролват дотам.
 *
 * Всяка връзка отваря нов таб и носи `rel="nofollow sponsored"`. Второто е
 * задължение към Google, не любезност: партньорска връзка без него е
 * нарушение на правилата за връзки и се наказва целият домейн.
 */

'use client';

import * as React from 'react';
import { Patch } from '@/components/ui/patch';

export type RecoLinkView = { merchant: string; url: string };
export type RecoBlockView = {
  kind: string;
  title: string;
  emoji: string;
  links: RecoLinkView[];
};

export function RecoBlocks({ blocks }: { blocks: RecoBlockView[] }) {
  if (blocks.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="display text-[19px]">Върви с това</h2>
      <p className="mt-1 text-[13px] leading-snug text-ink-45">
        Връзките водят към магазините ни партньори.
      </p>

      <ul className="stagger mt-4 space-y-3">
        {blocks.map((block) => (
          <li key={block.kind}>
            <Patch material="paper" className="px-4 py-3.5">
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="text-[16px]">
                  {block.emoji}
                </span>
                <span className="text-[14.5px] font-semibold">{block.title}</span>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-2">
                {block.links.map((link) => (
                  <a
                    key={`${block.kind}-${link.merchant}`}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow sponsored"
                    className="pressable rounded-full bg-ink px-3.5 py-2 text-[12.5px] font-semibold text-paper"
                  >
                    {link.merchant}
                  </a>
                ))}
              </div>
            </Patch>
          </li>
        ))}
      </ul>
    </section>
  );
}
