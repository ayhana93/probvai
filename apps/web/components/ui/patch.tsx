/**
 * ПАРЧЕТО
 *
 * Формата, от която е сглобено логото: изрязано парче материал, залепено
 * леко накриво. Тук е като компонент, за да не се повтаря на десет места.
 *
 * ⚠ Наклонът е малък нарочно — до 3 градуса. Повече изглежда като счупен
 *   layout, а не като нарочно решение.
 */

import * as React from 'react';
import { cn } from '@/lib/cn';

export type Material =
  | 'denim'
  | 'leather'
  | 'foil'
  | 'felt'
  | 'knit'
  | 'dots'
  | 'fur'
  | 'paper';

const MATERIAL: Record<Material, string> = {
  denim: 'tx-denim tx-denim-stitch',
  leather: 'tx-leather',
  foil: 'tx-foil',
  felt: 'tx-felt',
  knit: 'tx-knit',
  dots: 'tx-dots',
  fur: 'tx-fur',
  paper: 'bg-paper-2 text-ink',
};

type Props = React.HTMLAttributes<HTMLElement> & {
  material?: Material;
  /** Наклон в градуси. Малките числа четат като „залепено", големите като „счупено". */
  tilt?: number;
  alt?: boolean;
  as?: 'div' | 'section' | 'article' | 'li';
};

export function Patch({
  material = 'paper',
  tilt = 0,
  alt,
  as = 'div',
  className,
  style,
  children,
  ...rest
}: Props) {
  const Tag = as as React.ElementType;

  return (
    <Tag
      className={cn('patch', alt && 'patch-alt', MATERIAL[material], className)}
      style={{ ...style, ...(tilt ? { transform: `rotate(${tilt}deg)` } : {}) }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/**
 * Заглавие в езика на логото: всяка дума на отделно парче, наклонена в
 * различна посока. Ползва се пестеливо — на екран стои ЕДНО такова.
 */
export function PatchHeading({
  words,
  className,
}: {
  words: { text: string; material: Material; tilt: number }[];
  className?: string;
}) {
  return (
    <h1 className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {words.map((word) => (
        <span
          key={word.text}
          className={cn(
            'patch display inline-block px-2.5 py-1 text-[26px]',
            MATERIAL[word.material],
          )}
          style={{ transform: `rotate(${word.tilt}deg)` }}
        >
          {word.text}
        </span>
      ))}
    </h1>
  );
}
