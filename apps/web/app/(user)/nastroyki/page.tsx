'use client';

import * as React from 'react';
import Link from 'next/link';
import { Patch } from '@/components/ui/patch';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ChevronRightIcon } from '@/components/ui/icons';
import { useMe } from '@/lib/use-me';
import { cn } from '@/lib/cn';

/**
 * НАСТРОЙКИ
 *
 * ═══ ЗАЩО ОПАСНОТО Е ДОЛУ И ИЗГЛЕЖДА РАЗЛИЧНО ═══
 *
 * Изтриването на профил стои най-долу, отделено, в друг цвят и иска
 * изписване на дума. Не защото е красиво, а защото е необратимо: кредитите
 * се губят, снимките се трият, а повторната регистрация не дава нови
 * безплатни кредити.
 *
 * Копче, което върши това с едно натискане, рано или късно го върши по
 * погрешка.
 */

type Row = {
  label: string;
  value?: string;
  href?: string;
  onClick?: () => void;
};

function Group({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section className="mt-7">
      <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-45">
        {title}
      </h2>

      <div className="mt-2 overflow-hidden rounded-[var(--radius-card)] bg-paper-2">
        {rows.map((row, index) => {
          const inner = (
            <>
              <span className="text-[15px] font-medium">{row.label}</span>
              <span className="flex items-center gap-1.5 text-[14px] text-ink-45">
                {row.value}
                {(row.href ?? row.onClick) && <ChevronRightIcon />}
              </span>
            </>
          );

          const shared = cn(
            'flex h-14 w-full items-center justify-between px-4 text-left',
            index > 0 && 'border-t border-ink/6',
            (row.href ?? row.onClick) && 'pressable',
          );

          if (row.href) {
            return (
              <Link key={row.label} href={row.href} className={shared}>
                {inner}
              </Link>
            );
          }
          if (row.onClick) {
            return (
              <button key={row.label} onClick={row.onClick} className={shared}>
                {inner}
              </button>
            );
          }
          return (
            <div key={row.label} className={shared}>
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const CONFIRM_WORD = 'ИЗТРИЙ';

/**
 * Излизането трие реда в базата и чак после праща човека на стартовия екран.
 *
 * Обратният ред би оставил жива сесия при спряла мрежа — тоест бутон
 * „Излез", който не е излязъл. Затова първо сървърът, после пренасочването.
 */
async function signOut(): Promise<void> {
  try {
    await fetch('/api/nalog/izhod', { method: 'POST' });
  } catch {
    // Дори при паднала мрежа пращаме човека навън. Бисквитката остава,
    // но следващото зареждане ще я подмине — сесията ще е изтрита при
    // първия успешен опит.
  }
  window.location.href = '/start';
}

export default function NastroykiPage() {
  const { me, reload } = useMe();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [typed, setTyped] = React.useState('');
  const [savingWardrobe, setSavingWardrobe] = React.useState(false);

  const canDelete = typed.trim().toUpperCase() === CONFIRM_WORD;

  const initial = (me?.profile.firstName ?? me?.email ?? '?').charAt(0).toUpperCase();
  const isPublic = me?.profile.wardrobePublic ?? false;

  /**
   * Смяната на видимостта минава през същия endpoint като регистрацията.
   * Един път до тази стойност значи една проверка за възраст — а не две,
   * от които втората рано или късно ще се разминава с първата.
   */
  async function setWardrobe(next: boolean): Promise<void> {
    if (!me || savingWardrobe) return;
    setSavingWardrobe(true);

    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          firstName: me.profile.firstName,
          lastName: me.profile.lastName,
          gender: me.profile.gender,
          age: me.profile.age,
          wardrobePublic: next,
        }),
      });
      await reload();
    } catch {
      // Без мрежа нищо не се променя. Показаното си остава вярно.
    } finally {
      setSavingWardrobe(false);
    }
  }

  return (
    <main className="px-5 pt-6">
      <h1 className="display text-[28px]">Настройки</h1>

      {/* ── Профилът ─────────────────────────────────────────────────────── */}
      <Patch material="leather" tilt={-1} className="mt-5 flex items-center gap-4 px-5 py-4">
        <span className="display grid size-12 shrink-0 place-items-center rounded-full bg-lime text-[18px] text-ink">
          {initial}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-paper">
            {me?.profile.firstName
              ? `${me.profile.firstName} ${me.profile.lastName ?? ''}`.trim()
              : (me?.email ?? '—')}
          </div>
          <div className="mt-0.5 truncate text-[12.5px] text-white/50">{me?.email}</div>
        </div>
      </Patch>

      {/* ── Нивото ───────────────────────────────────────────────────────
          Не е таблица с планове и не се казва „премиум". VIP Closet се
          ОТКЛЮЧВА — затова тук пише докъде е стигнал човекът, а не колко
          струва да прескочи. */}
      {me?.tier && (
        <Patch material="paper" className="mt-3 px-5 py-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] font-semibold">
              {me.tier.vip ? '🔑 VIP Closet' : `${me.tier.emoji} ${me.tier.rank}`}
            </span>
            <span className="text-[12.5px] text-ink-45">{me.tier.xp} точки</span>
          </div>

          <p className="mt-1 text-[13px] leading-snug text-ink-45">
            {me.tier.vip
              ? 'Снимки в HD, значка и предимство на опашката.'
              : me.tier.next
                ? `${me.tier.rankNote}. Още ${me.tier.toNext} проби до ${me.tier.next}.`
                : me.tier.rankNote}
          </p>

          {!me.tier.vip && (
            <p className="mt-2 text-[12.5px] text-ink-25">
              VIP Closet се отключва при €{me.tier.toVipEur} още похарчени.
            </p>
          )}
        </Patch>
      )}

      {/* ── Гардеробът ───────────────────────────────────────────────────
          Единствената настройка, която пуска нещо навън. Затова е с две
          изрични копчета, а не с превключвател, който се бута случайно. */}
      <section className="mt-7">
        <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-45">
          Гардероб
        </h2>

        <div className="mt-2 overflow-hidden rounded-[var(--radius-card)] bg-paper-2 p-3">
          <div className="flex gap-2">
            <button
              onClick={() => void setWardrobe(false)}
              aria-pressed={!isPublic}
              disabled={savingWardrobe}
              className={cn(
                'pressable h-11 flex-1 rounded-full text-[13.5px] font-semibold',
                !isPublic ? 'bg-ink text-paper' : 'bg-paper-3 text-ink-70',
              )}
            >
              Личен
            </button>
            <button
              onClick={() => void setWardrobe(true)}
              aria-pressed={isPublic}
              disabled={savingWardrobe}
              className={cn(
                'pressable h-11 flex-1 rounded-full text-[13.5px] font-semibold',
                isPublic ? 'bg-ink text-paper' : 'bg-paper-3 text-ink-70',
              )}
            >
              Публичен
            </button>
          </div>

          <p className="mt-2.5 px-1 text-[12.5px] leading-snug text-ink-45">
            {isPublic
              ? 'Можеш да пускаш избрани визии в Lookbook. Всяка се пуска поотделно — нищо не излиза само.'
              : 'Никой освен теб не вижда пробите ти.'}
          </p>
        </div>
      </section>

      <Group
        title="Профил"
        rows={[
          {
            label: 'Снимка по подразбиране',
            value: me?.hasDefaultPhoto ? 'Зададена' : 'Няма',
            href: '/nastroyki/snimka',
          },
          {
            label: 'Телефон',
            value: me?.phoneVerified ? 'Потвърден' : 'Не е потвърден',
            href: '/nastroyki/telefon',
          },
          { label: 'Език', value: 'Български' },
        ]}
      />

      <Group
        title="Известия"
        rows={[
          { label: 'Когато пробата е готова', value: 'Включено' },
          { label: 'Новини и оферти', value: 'Изключено' },
        ]}
      />

      <Group
        title="Данни"
        rows={[
          { label: 'Свали всичките ми данни', href: '/nastroyki/eksport' },
          { label: 'Условия за ползване', href: '/usloviya' },
          { label: 'Политика за поверителност', href: '/poveritelnost' },
          { label: 'Пиши ни', href: '/podkrepa' },
        ]}
      />

      {/* ── Излизане ─────────────────────────────────────────────────────
          Отделено от изтриването с разстояние и с друг цвят. Двете копчета
          едно до друго са класическата грешка: излизането се натиска всеки
          месец, изтриването — веднъж и завинаги. */}
      <section className="mt-8">
        <button
          onClick={() => void signOut()}
          className="pressable flex h-14 w-full items-center justify-center rounded-[var(--radius-card)] bg-paper-2 text-[15px] font-semibold"
        >
          Излез от профила
        </button>
      </section>

      {/* ── Необратимото ─────────────────────────────────────────────────── */}
      <section className="mt-10">
        <button
          onClick={() => setDeleteOpen(true)}
          className="pressable flex h-14 w-full items-center justify-center rounded-[var(--radius-card)] border border-danger/25 text-[15px] font-semibold text-danger"
        >
          Изтрий профила ми
        </button>
      </section>

      <p className="mt-8 text-center text-[12px] text-ink-25">ПРОБВАЙ · версия 0.1</p>

      <Sheet
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setTyped('');
        }}
        title="Изтриване на профила"
      >
        <div className="pb-2">
          <ul className="space-y-2 text-[14px] leading-snug text-ink-70">
            <li>· Кредитите ти се губят безвъзвратно. Не се връщат пари.</li>
            <li>· Всички снимки и проби се изтриват.</li>
            <li>· Нова регистрация със същия имейл няма да получи безплатни кредити.</li>
            <li>· Данните за плащания остават, както изисква законът.</li>
          </ul>

          <label className="mt-5 block">
            <span className="text-[13.5px] text-ink-70">
              Напиши <strong className="font-semibold">{CONFIRM_WORD}</strong>, за да потвърдиш:
            </span>
            <input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
              className={cn(
                'mt-2 h-14 w-full rounded-[var(--radius-card)] bg-paper-2 px-4',
                'text-[15px] tracking-[0.12em] placeholder:text-ink-25',
                'outline-none transition-colors duration-[var(--dur-menu)] ease-[var(--ease-out)]',
                canDelete && 'bg-danger/10',
              )}
              placeholder={CONFIRM_WORD}
            />
          </label>

          <Button variant="danger" size="lg" block disabled={!canDelete} className="mt-4">
            Изтрий профила завинаги
          </Button>

          <button
            onClick={() => {
              setDeleteOpen(false);
              setTyped('');
            }}
            className="pressable mt-2 flex h-12 w-full items-center justify-center text-[14px] font-semibold text-ink-45"
          >
            Откажи
          </button>
        </div>
      </Sheet>
    </main>
  );
}
