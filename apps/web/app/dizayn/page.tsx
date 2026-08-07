'use client';

import * as React from 'react';
import { Mascot, type MascotState } from '@/components/mascot';
import { Button, IconButton } from '@/components/ui/button';
import { Patch, PatchHeading, type Material } from '@/components/ui/patch';
import { Sheet } from '@/components/ui/sheet';
import { Tabs } from '@/components/ui/tabs';
import { CircleMark, Sparks, Underscribble, Zigzag } from '@/components/ui/scribble';
import { GearIcon } from '@/components/ui/icons';

/**
 * ДИЗАЙН ЕЗИКЪТ, на един екран.
 *
 * Не е страница от приложението — работен инструмент. Тук се вижда наведнъж
 * дали материалите вървят заедно, дали героят чете на всички състояния и
 * дали копчетата са в един тон.
 */

const MATERIALS: { key: Material; label: string; note: string }[] = [
  { key: 'denim', label: 'Деним', note: 'от „П"' },
  { key: 'knit', label: 'Плетка', note: 'от „Р"' },
  { key: 'foil', label: 'Фолио', note: 'от „О"' },
  { key: 'leather', label: 'Кожа', note: 'от „Б"' },
  { key: 'felt', label: 'Филц', note: 'от „В"' },
  { key: 'dots', label: 'Точки', note: 'от „А"' },
  { key: 'fur', label: 'Кожухче', note: 'от „Й"' },
  { key: 'paper', label: 'Хартия', note: 'основата' },
];

const MASCOTS: { credits: number; state: MascotState; days: number; label: string }[] = [
  { credits: 0, state: 'idle', days: 0, label: '0 кредита' },
  { credits: 3, state: 'idle', days: 0, label: '1–4' },
  { credits: 12, state: 'idle', days: 0, label: '5 и повече' },
  { credits: 25, state: 'idle', days: 0, label: 'пълна' },
  { credits: 8, state: 'idle', days: 9, label: 'не си идвала' },
  { credits: 8, state: 'generating', days: 0, label: 'работи' },
  { credits: 8, state: 'success', days: 0, label: 'готово' },
  { credits: 2, state: 'error', days: 0, label: 'не се получи' },
];

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="display text-[17px] text-ink-45">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function DizaynPage() {
  const [tab, setTab] = React.useState<'a' | 'b'>('a');
  const [open, setOpen] = React.useState(false);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] px-5 py-8">
      <PatchHeading
        words={[
          { text: 'Дизайн', material: 'denim', tilt: -2 },
          { text: 'език', material: 'knit', tilt: 1.5 },
        ]}
      />

      <Row title="Материалите">
        <div className="grid grid-cols-4 gap-2.5">
          {MATERIALS.map((material, i) => (
            <Patch
              key={material.key}
              material={material.key}
              tilt={i % 2 ? 1.5 : -1.5}
              className="grid h-20 place-items-center px-1 text-center"
            >
              <div>
                <div className="text-[12px] font-bold leading-tight">{material.label}</div>
                <div className="mt-0.5 text-[9.5px] opacity-60">{material.note}</div>
              </div>
            </Patch>
          ))}
        </div>
      </Row>

      <Row title="Героят">
        <div className="grid grid-cols-4 gap-y-5">
          {MASCOTS.map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-1.5">
              <Mascot
                credits={item.credits}
                state={item.state}
                daysSinceLastUse={item.days}
                size={70}
              />
              <span className="text-center text-[10px] leading-tight text-ink-45">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </Row>

      <Row title="Копчета">
        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="action" size="lg">Генерирай</Button>
          <Button variant="ink">Запази</Button>
          <Button variant="quiet">Смени</Button>
          <Button variant="ghost" size="sm">Откажи</Button>
          <Button variant="danger" size="sm">Изтрий</Button>
          <IconButton label="Настройки" variant="quiet">
            <GearIcon className="size-5" />
          </IconButton>
        </div>
        <p className="mt-3 text-[12.5px] leading-snug text-ink-45">
          Едно лайм копче на екран. Сложиш ли две, нито едно не е главното.
        </p>
      </Row>

      <Row title="Табове с изрязване">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'a', label: 'Постави линк' },
            { value: 'b', label: 'Качи снимка' },
          ]}
        />
        <p className="mt-3 text-[12.5px] leading-snug text-ink-45">
          Списъкът е нарисуван два пъти. Анимира се изрязването, не цветът —
          затова надписът никога не минава през сиво.
        </p>
      </Row>

      <Row title="Ръчните щрихи">
        <div className="flex items-center gap-6 text-ink">
          <Sparks className="h-6 w-10" />
          <Zigzag className="h-6 w-24" />
          <div className="relative px-4 py-2">
            <span className="display relative z-10 text-[15px]">важно</span>
            <CircleMark className="absolute inset-0 text-violet" />
          </div>
        </div>
        <Underscribble className="mt-3 h-3 w-40 text-lime-deep" />
      </Row>

      <Row title="Лист отдолу">
        <Button variant="ink" onClick={() => setOpen(true)}>Отвори лист</Button>
        <Sheet open={open} onClose={() => setOpen(false)} title="Настройки">
          <div className="pb-4">
            <div className="flex h-14 items-center justify-between px-1">
              <span className="text-[15px] font-medium">Съотношение</span>
              <span className="text-[15px] text-ink-45">Auto ›</span>
            </div>
            <div className="flex h-14 items-center justify-between px-1">
              <span className="text-[15px] text-ink-25">Резолюция</span>
              <span className="text-[15px] text-ink-25">1K</span>
            </div>
          </div>
        </Sheet>
      </Row>

      <Row title="Зареждане">
        <div className="space-y-2.5">
          <div className="skeleton h-14 rounded-[var(--radius-card)]" />
          <div className="skeleton h-14 w-2/3 rounded-[var(--radius-card)]" />
        </div>
        <p className="mt-3 text-[12.5px] leading-snug text-ink-45">
          Скелети, не въртящи се кръгчета. Скелетът показва какво идва.
        </p>
      </Row>
    </main>
  );
}
