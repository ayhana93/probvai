'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMe } from '@/lib/use-me';
import { Button } from '@/components/ui/button';
import { Patch } from '@/components/ui/patch';
import { Sheet } from '@/components/ui/sheet';
import { Tabs } from '@/components/ui/tabs';
import { Sparks } from '@/components/ui/scribble';
import { CheckIcon, ChevronRightIcon, CrossIcon, GearIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

/**
 * ПОТОК НА ГЕНЕРАЦИЯ
 *
 * Две стъпки, една под друга, без пренасочване между страници. Смяната на
 * страница къса нишката — тук всичко се вижда наведнъж и се скролва.
 */

const RATIOS = [
  { value: 'auto', label: 'Auto' },
  { value: '3:4', label: '3:4' },
  { value: '4:5', label: '4:5' },
  { value: '9:16', label: '9:16' },
  { value: '1:1', label: '1:1' },
] as const;

type Ratio = (typeof RATIOS)[number]['value'];

const GOOD = [
  'Лицето да се вижда ясно',
  'Цял ръст или до коленете',
  'Добра светлина, без сенки',
  'Права стойка, ръцете свободни',
];

function Check({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full',
        ok ? 'bg-lime text-ink' : 'bg-ink text-paper',
      )}
    >
      {ok ? <CheckIcon /> : <CrossIcon />}
    </span>
  );
}

/** Номерът на стъпката, на парче — езикът на логото, но пестеливо. */
function StepBadge({ n, done }: { n: number; done?: boolean }) {
  return (
    <span
      className={cn(
        'display grid size-9 shrink-0 place-items-center rounded-full text-[16px]',
        done ? 'bg-lime text-ink' : 'bg-ink text-paper',
      )}
    >
      {n}
    </span>
  );
}

export default function ProbaPage() {
  return (
    <React.Suspense fallback={<main className="px-5 pt-6"><div className="skeleton h-40 rounded-[var(--radius-card)]" /></main>}>
      <Proba />
    </React.Suspense>
  );
}

function Proba() {
  const router = useRouter();
  const params = useSearchParams();
  const { me } = useMe();

  // Качването е по подразбиране. Повечето хора вече имат снимката в
  // телефона си; линкът е за тези, които още разглеждат магазина.
  const [tab, setTab] = React.useState<'upload' | 'link'>('upload');
  const [ratio, setRatio] = React.useState<Ratio>('auto');
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [ratioOpen, setRatioOpen] = React.useState(false);
  const [link, setLink] = React.useState('');
  const [garment, setGarment] = React.useState(false);

  /**
   * „Пробвай този аутфит" от Lookbook.
   *
   * Дрехата се копира в собствения префикс на човека още при отварянето на
   * екрана — така, когато натисне „Генерирай", няма второ чакане. Копието е
   * евтино; чакането не е.
   */
  const inspiration = params.get('vdahnovenie');
  const [borrowedKey, setBorrowedKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!inspiration) return;
    let alive = true;

    void fetch(`/api/lookbook/${inspiration}/try`, { method: 'POST' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { garmentKey: string } | null) => {
        if (alive && data) {
          setBorrowedKey(data.garmentKey);
          setGarment(true);
          setTab('upload');
        }
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, [inspiration]);

  const credits = me?.credits ?? 0;
  const [starting, setStarting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const hasPhoto = me?.hasDefaultPhoto ?? false;
  const ready = hasPhoto && (tab === 'link' ? link.trim().length > 0 : garment);

  /**
   * Пускането на генерация.
   *
   * Копчето се заключва за целия път, не само докато лети заявката. Иначе
   * двойното натискане пуска две генерации и харчи два кредита — точно
   * това, срещу което е цялата защита от страна на сървъра.
   */
  async function start(): Promise<void> {
    if (starting || !ready) return;
    setStarting(true);
    setError(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          personKey: 'PLACEHOLDER',
          garmentKey: borrowedKey ?? 'PLACEHOLDER',
          aspectRatio: ratio,
          // Линкът е единственият случай, в който знаем от кой магазин е
          // дрехата. При качена снимка не пращаме магазин — и после в
          // гардероба не пише име, вместо да пише измислено.
          ...(tab === 'link'
            ? { source: 'LINK', productUrl: link.trim() }
            : { source: 'UPLOAD' }),
        }),
      });

      const data = (await response.json()) as
        | { generationId: string }
        | { error: { message: string } };

      if (!response.ok || !('generationId' in data)) {
        setError('error' in data ? data.error.message : 'Нещо се обърка. Пробвай пак.');
        setStarting(false);
        return;
      }

      router.push(`/proba/${data.generationId}`);
    } catch {
      setError('Няма връзка. Провери интернета и пробвай пак.');
      setStarting(false);
    }
  }

  return (
    <main className="px-5 pt-6">
      <div className="flex items-center gap-2">
        <h1 className="display text-[28px]">Нова проба</h1>
        <Sparks className="mb-2 h-3.5 w-6 text-violet" />
      </div>

      {inspiration && (
        <p className="enter-rise mt-3 rounded-[var(--radius-card)] bg-violet-wash px-4 py-3 text-[13.5px] leading-snug text-ink-70">
          {borrowedKey
            ? 'Дрехата от избраната визия е готова. Остава да натиснеш.'
            : 'Взимаме дрехата от избраната визия...'}
        </p>
      )}

      {/* ── Стъпка 1 ────────────────────────────────────────────────────── */}
      <section className="mt-6">
        <div className="flex items-center gap-3">
          <StepBadge n={1} done={hasPhoto} />
          <h2 className="text-[17px] font-semibold">Твоята снимка</h2>
        </div>

        <div className="mt-3 flex gap-3">
          <Patch
            material="paper"
            className="grid h-[152px] w-[114px] shrink-0 place-items-center overflow-hidden"
          >
            {/* Запазената снимка. Скелет, докато се зареди — не въртящо кръгче. */}
            <div className="skeleton size-full" />
          </Patch>

          <div className="flex flex-1 flex-col justify-between py-0.5">
            <ul className="space-y-1.5">
              {GOOD.map((line) => (
                <li key={line} className="flex gap-2 text-[13.5px] leading-tight text-ink-70">
                  <Check ok />
                  {line}
                </li>
              ))}
              <li className="flex gap-2 text-[13.5px] leading-tight text-ink-45">
                <Check ok={false} />
                Не отдалеч · не в тъмно · не с очила
              </li>
            </ul>

            <Button variant="quiet" size="sm" className="mt-3 self-start">
              Смени снимката
            </Button>
          </div>
        </div>
      </section>

      {/* ── Стъпка 2 ────────────────────────────────────────────────────── */}
      <section className="mt-8">
        <div className="flex items-center gap-3">
          <StepBadge n={2} done={ready} />
          <h2 className="text-[17px] font-semibold">Дрехата</h2>
        </div>

        <Tabs
          className="mt-3"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'upload', label: 'Качи снимка' },
            { value: 'link', label: 'Постави линк' },
          ]}
        />

        {tab === 'link' ? (
          <div className="enter-pop mt-3">
            <input
              value={link}
              onChange={(event) => setLink(event.target.value)}
              inputMode="url"
              placeholder="Shein, Vinted, Zalando, Answear..."
              className={cn(
                'h-14 w-full rounded-[var(--radius-card)] bg-paper-2 px-4',
                'text-[15px] placeholder:text-ink-25',
                'outline-none transition-[background-color] duration-[var(--dur-menu)] ease-[var(--ease-out)]',
                'focus:bg-paper-3',
              )}
            />
          </div>
        ) : (
          <button
            onClick={() => setGarment((value) => !value)}
            className={cn(
              'pressable enter-pop mt-3 grid h-32 w-full place-items-center',
              'rounded-[var(--radius-card)] border-2 border-dashed bg-paper-2',
              garment ? 'border-lime-deep' : 'border-ink-25',
            )}
          >
            <span className="text-[14px] font-semibold text-ink-45">
              {garment ? 'Снимката е избрана' : 'Избери снимка от телефона'}
            </span>
          </button>
        )}

        <p className="mt-2.5 text-[13px] leading-snug text-ink-45">
          Може да е снимка на дреха, цял аутфит или скрийншот.
        </p>
      </section>

      {/* ── Действието ──────────────────────────────────────────────────────
          Копчето за генериране е широко и лаймово; зъбното колело е малко
          и тихо до него. Едното е действие, другото е настройка — и това
          трябва да си личи от разстояние, без да се чете. */}
      <div className="mt-8 flex items-center gap-2.5">
        <Button
          variant="action"
          size="lg"
          block
          disabled={!ready}
          busy={starting}
          onClick={() => void start()}
        >
          {starting ? 'Пускаме я...' : ready ? 'Генерирай · 1 кредит' : 'Първо избери дреха'}
        </Button>

        <button
          aria-label="Настройки на генерирането"
          onClick={() => setSettingsOpen(true)}
          className="pressable grid size-14 shrink-0 place-items-center rounded-full bg-paper-2 text-ink-70"
        >
          <GearIcon />
        </button>
      </div>

      {error ? (
        <p className="enter-rise mt-3 text-center text-[13px] text-danger">{error}</p>
      ) : (
        <p className="mt-3 text-center text-[12.5px] text-ink-45">
          Имаш {credits} {credits === 1 ? 'кредит' : 'кредита'}.
        </p>
      )}

      {/* ── Настройките ─────────────────────────────────────────────────── */}
      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Настройки">
        <div className="pb-2">
          <button
            onClick={() => setRatioOpen(true)}
            className="pressable flex h-14 w-full items-center justify-between rounded-2xl px-1 text-left"
          >
            <span className="text-[15px] font-medium">Съотношение</span>
            <span className="flex items-center gap-1.5 text-[15px] text-ink-45">
              {RATIOS.find((r) => r.value === ratio)?.label}
              <ChevronRightIcon />
            </span>
          </button>

          {/* Тези два реда СЕ ВИЖДАТ, но не се пипат. Показваме с какво
              качество работим — това е прозрачност, не настройка.
              Затова: по-светъл текст, без стрелка, без hover, без hit target. */}
          <div className="flex h-14 items-center justify-between px-1">
            <span className="text-[15px] text-ink-25">Резолюция</span>
            <span className="text-[15px] text-ink-25">1K</span>
          </div>
          <div className="flex h-14 items-center justify-between px-1">
            <span className="text-[15px] text-ink-25">Режим</span>
            <span className="text-[15px] text-ink-25">Бърз</span>
          </div>

          <p className="mt-1 text-[12.5px] leading-snug text-ink-25">
            Резолюцията и режимът са еднакви за всички проби.
          </p>
        </div>
      </Sheet>

      <Sheet open={ratioOpen} onClose={() => setRatioOpen(false)} title="Съотношение">
        <ul className="pb-2">
          {RATIOS.map((option) => (
            <li key={option.value}>
              <button
                onClick={() => {
                  setRatio(option.value);
                  setRatioOpen(false);
                }}
                className="pressable flex h-14 w-full items-center justify-between rounded-2xl px-1 text-left"
              >
                <span className="text-[15px] font-medium">{option.label}</span>
                {ratio === option.value && (
                  <svg viewBox="0 0 24 24" className="size-5 text-violet" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4 10-10" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </main>
  );
}
