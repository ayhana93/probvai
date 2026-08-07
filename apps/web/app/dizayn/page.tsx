'use client';

import * as React from 'react';
import { Mascot, MascotButton, MOOD_THRESHOLDS, type MascotMood } from '@/components/mascot';
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

const MASCOTS: { mood: MascotMood; label: string; when: string }[] = [
  { mood: 'empty', label: 'празен', when: '0 кредита' },
  { mood: 'low', label: 'малко', when: `1–${MOOD_THRESHOLDS.happy - 1}` },
  { mood: 'happy', label: 'доволен', when: `${MOOD_THRESHOLDS.happy}–${MOOD_THRESHOLDS.full - 1}` },
  { mood: 'full', label: 'пълен', when: `${MOOD_THRESHOLDS.full}+` },
  { mood: 'stale', label: 'цупи се', when: `${MOOD_THRESHOLDS.staleDays}+ дни` },
  { mood: 'working', label: 'работи', when: 'генерира' },
  { mood: 'done', label: 'готово', when: 'успех' },
  { mood: 'failed', label: 'провал', when: 'грешка' },
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
            <div key={item.mood} className="flex flex-col items-center gap-1">
              <Mascot mood={item.mood} size={72} />
              <span className="text-center text-[10.5px] font-semibold leading-tight">
                {item.label}
              </span>
              <span className="text-center text-[9.5px] leading-tight text-ink-45">
                {item.when}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[12.5px] leading-snug text-ink-45">
          Прагът {MOOD_THRESHOLDS.full} не е случаен: безплатните кредити
          стигат най-много до 5, а най-малката покупка е 25. Значи над
          {' '}{MOOD_THRESHOLDS.full} стига само човек, който е платил —
          и празничното лице е негово.
        </p>

        <div className="mt-7 rounded-[var(--radius-card)] bg-paper-2 py-6">
          <MascotButton credits={12} label="Генерирай" hint="1 кредит" />
        </div>
        <p className="mt-3 text-[12.5px] leading-snug text-ink-45">
          Героят Е копчето за нова проба. Няма правоъгълник около него.
        </p>
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
