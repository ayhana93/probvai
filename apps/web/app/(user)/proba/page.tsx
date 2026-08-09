'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMe } from '@/lib/use-me';
import { Logo } from '@/components/logo';
import { PhotoSlot } from '@/components/photo-slot';
import { Sheet } from '@/components/ui/sheet';
import { Tabs } from '@/components/ui/tabs';
import { Sparks } from '@/components/ui/scribble';
import { CheckIcon, ChevronRightIcon, CrossIcon, GearIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { tryOnResult } from '@/lib/routes';

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

/**
 * Колкото приема и сървърът. Полето спира дотук, за да не се пише текст,
 * който после мълчаливо се реже.
 */
const MAX_PROMPT = 300;

/** Примери за описанието. Показват ВИДА неща, не готови изречения. */
const PROMPT_EXAMPLES = [
  'на плажа по залез',
  'офис обстановка',
  'студийна светлина',
  'на улицата в града',
];

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

  /** Какво иска човекът с думи. Празно значи „нищо конкретно". */
  const [prompt, setPrompt] = React.useState('');

  /**
   * Ключовете на качените снимки.
   *
   * `null` значи „още няма". Преди тук стоеше `boolean` и низът
   * `'PLACEHOLDER'` отиваше към сървъра — екранът изглеждаше готов, а
   * генерация не тръгваше никога.
   */
  const [personKey, setPersonKey] = React.useState<string | null>(null);
  const [garmentKey, setGarmentKey] = React.useState<string | null>(null);

  /**
   * „Пробвай този аутфит" от Lookbook.
   *
   * Дрехата се копира в собствения префикс на човека още при отварянето на
   * екрана — така, когато натисне „Генерирай", няма второ чакане. Копието е
   * евтино; чакането не е.
   */
  const inspiration = params.get('vdahnovenie');

  React.useEffect(() => {
    if (!inspiration) return;
    let alive = true;

    void fetch(`/api/lookbook/${inspiration}/try`, { method: 'POST' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { garmentKey: string } | null) => {
        if (alive && data) {
          setGarmentKey(data.garmentKey);
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
  // Какво точно се случва в момента. При линк пътят е от две части и
  // мълчаливото копче кара човек да мисли, че е забило.
  const [stage, setStage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  /**
   * ═══ КОГА СТЪПКАТА Е НАИСТИНА ЗАВЪРШЕНА ═══
   *
   * Стъпка 1 е готова САМО ако снимката е качена сега — виж защо при самото
   * каре. Стъпка 2 — ако сървърът е върнал ключ за дрехата, или ако е
   * поставен линк.
   *
   * Само тогава копчето се отключва: процес с пропусната стъпка няма как да
   * бъде завършен, защото няма какво да се прати.
   */
  const hasPhoto = Boolean(personKey);
  const hasGarment = tab === 'link' ? link.trim().length > 0 : Boolean(garmentKey);
  const ready = hasPhoto && hasGarment;

  /**
   * ═══ ТРЕТАТА СТЪПКА СЕ ПОКАЗВА САМА ═══
   *
   * Появява се под сгъвката — човек тъкмо е гледал карето на дрехата и
   * няма причина да скролва надолу, защото не знае, че там вече има нещо.
   *
   * Придвижването е `smooth` и до „nearest", не до върха: екранът трябва
   * само да ДОПУСНЕ новото в полезрението, а не да прескочи. Рязък скок
   * тук се чете като че ли приложението е сменило страницата.
   *
   * Прави се веднъж — при първото ставане на готов. Иначе всяка смяна на
   * снимката щеше да дърпа екрана пак.
   */
  const third = React.useRef<HTMLElement | null>(null);
  const nudged = React.useRef(false);

  React.useEffect(() => {
    if (!ready || nudged.current) return;
    nudged.current = true;
    // Един кадър изчакване, за да е рисувана вече секцията.
    const timer = setTimeout(() => {
      third.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
    return () => clearTimeout(timer);
  }, [ready]);

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
      /**
       * ═══ ЛИНКЪТ СТАВА КЛЮЧ ПРЕДИ ГЕНЕРАЦИЯТА ═══
       *
       * Генерацията работи само с файлове в нашето хранилище — чужд адрес
       * не влиза никъде. Затова линкът първо минава през
       * `/api/extract-garment`, който отваря страницата, взима снимката на
       * продукта и я качва. Едва тогава има какво да се пробва.
       *
       * Прави се тук, а не при писане на линка: докато човек го поставя и
       * поправя, всяко натискане на клавиш би пускало обръщение навън.
       */
      let key = garmentKey;
      let merchant: string | null = null;

      if (tab === 'link') {
        setStage('Взимаме дрехата от линка...');

        const taken = await fetch('/api/extract-garment', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: link.trim() }),
        });

        const found = (await taken.json()) as
          | { garmentKey: string; merchant: string | null }
          | { error: { message: string } };

        if (!taken.ok || !('garmentKey' in found)) {
          setError(
            'error' in found
              ? found.error.message
              : 'Не успях да взема дрехата от този линк. Пробвай със снимка.',
          );
          setStarting(false);
          setStage(null);
          return;
        }

        key = found.garmentKey;
        merchant = found.merchant;
        setGarmentKey(found.garmentKey);
      }

      if (!key) {
        setError('Липсва снимка на дрехата.');
        setStarting(false);
        setStage(null);
        return;
      }

      setStage('Пускаме пробата...');

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          personKey,
          garmentKey: key,
          aspectRatio: ratio,
          prompt: prompt.trim(),
          // Линкът е единственият случай, в който знаем от кой магазин е
          // дрехата. При качена снимка не пращаме магазин — и после в
          // гардероба не пише име, вместо да пише измислено.
          ...(tab === 'link'
            ? { source: 'LINK', productUrl: link.trim(), merchant }
            : { source: 'UPLOAD' }),
        }),
      });

      const data = (await response.json()) as
        | { generationId: string }
        | { error: { message: string } };

      if (!response.ok || !('generationId' in data)) {
        setError('error' in data ? data.error.message : 'Нещо се обърка. Пробвай пак.');
        setStarting(false);
        setStage(null);
        return;
      }

      router.push(tryOnResult(data.generationId));
    } catch {
      setError('Няма връзка. Провери интернета и пробвай пак.');
      setStarting(false);
      setStage(null);
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
          {garmentKey
            ? 'Дрехата от избраната визия е готова. Остава да натиснеш.'
            : 'Взимаме дрехата от избраната визия...'}
        </p>
      )}

      {/* ── Описанието ──────────────────────────────────────────────────────

          ═══ ЗАЩО Е ПЪРВО, ПРЕДИ СНИМКИТЕ ═══

          Написано най-отдолу, до копчето, то се чете като „още нещо, ако
          ти се занимава" — и никой не го попълва. Тук е първото, което се
          вижда: човек тъкмо е решил какво иска и точно тогава може да го
          каже с думи.

          ═══ ЗАЩО НЕ Е ЗАДЪЛЖИТЕЛНО ═══

          Пробата работи и без него. Заковано като условие, то би спряло
          човека, дошъл да види как му стои една тениска. Затова: покана, не
          въпрос — и изрично казваме какво се печели.

          ═══ ЗАЩО ИМА ГОТОВИ ПРИМЕРИ ═══

          „Опиши какво искаш" пред празно поле е изпит. Три натискаеми
          примера показват какъв ВИД неща стават — обстановка, светлина,
          поза — и оттам човек допълва свое. */}
      <section className="mt-6">
        <div className="flex items-center gap-2">
          <h2 className="text-[17px] font-semibold">Кажи какво искаш</h2>
          <span className="rounded-full bg-paper-2 px-2 py-0.5 text-[11px] font-semibold text-ink-45">
            по избор
          </span>
        </div>

        <p className="mt-1.5 text-[13px] leading-snug text-ink-45">
          Напишеш ли няколко думи, снимката излиза по-добра. Обстановка,
          светлина, поза — каквото си представяш.
        </p>

        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value.slice(0, MAX_PROMPT))}
          rows={2}
          placeholder="Например: на плажа по залез, естествена светлина"
          className={cn(
            'mt-3 w-full resize-none rounded-[var(--radius-card)] bg-paper-2 px-4 py-3',
            'text-[15px] leading-snug placeholder:text-ink-25',
            'outline-none transition-[background-color] duration-[var(--dur-menu)] ease-[var(--ease-out)]',
            'focus:bg-paper-3',
          )}
        />

        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="-mx-5 flex-1 overflow-x-auto px-5">
            <div className="flex gap-2">
              {PROMPT_EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setPrompt(example)}
                  className="pressable shrink-0 whitespace-nowrap rounded-full bg-paper-2 px-3 py-1.5 text-[12px] font-medium text-ink-70"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {/* Броячът се появява едва към края. Показан от нулата, той
              превръща поканата в изискване. */}
          {prompt.length > MAX_PROMPT - 80 && (
            <span className="shrink-0 text-[12px] tabular-nums text-ink-25">
              {MAX_PROMPT - prompt.length}
            </span>
          )}
        </div>
      </section>

      {/* ── Стъпка 1 ────────────────────────────────────────────────────── */}
      <section className="mt-8">
        <div className="flex items-center gap-3">
          <StepBadge n={1} done={hasPhoto} />
          <h2 className="text-[17px] font-semibold">Твоята снимка</h2>
        </div>

        <div className="mt-3 flex gap-3">
          {/* Запазената снимка се показва като начална. Натискането отваря
              галерията — и старата снимка се сменя със новата. */}
          {/* ═══ ВСЯКА НОВА ПРОБА ЗАПОЧВА ПРАЗНА ═══

              Тук стоеше последната качена снимка. Изглеждаше като услуга и
              беше капан: човек влиза за нова проба, вижда пълно каре със
              зелен кант, приема го за готово и генерира — върху снимка,
              която не е искал. При мен това се случи с ПРОФИЛНАТА снимка:
              беше последното качено и излезе като снимка за проба.

              Празното каре е по-честно. Едно натискане повече, нула
              изхарчени кредити върху грешната снимка. */}
          <PhotoSlot
            kind="person"
            setAsDefault
            value={personKey}
            onChange={setPersonKey}
            hint="Качи своя снимка"
            className="h-[172px] w-[130px] shrink-0"
          />

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

            <p className="mt-3 text-[12.5px] leading-snug text-ink-45">
              {hasPhoto
                ? 'Натисни снимката, за да я смениш.'
                : 'Натисни плюса и избери снимка от телефона.'}
            </p>
          </div>
        </div>
      </section>

      {/* ── Стъпка 2 ────────────────────────────────────────────────────── */}
      <section className="mt-8">
        <div className="flex items-center gap-3">
          <StepBadge n={2} done={hasGarment} />
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
          <PhotoSlot
            kind="garment"
            value={garmentKey}
            onChange={setGarmentKey}
            hint="Качи снимка на дрехата"
            // Карето следва снимката, вместо тя да следва карето. Дрехата се
            // вижда ЦЯЛА — нито отрязана, нито удавена в бели полета.
            grow
            maxHeight={430}
            className="enter-pop mt-3 h-40 w-full"
          />
        )}

        <p className="mt-2.5 text-[13px] leading-snug text-ink-45">
          Може да е снимка на дреха, цял аутфит или скрийншот.
        </p>
      </section>

      {/* ── Стъпка 3 ────────────────────────────────────────────────────────
          ═══ ЗАЩО Я ЯМА, ДОКАТО ДВЕТЕ ГОРЕ НЕ СА ГОТОВИ ═══

          Сиво копче, което стои от самото начало, е обещание, което екранът
          не спазва — човек го натиска, нищо не става и остава да гадае коя
          стъпка е пропуснал. Тук третата стъпка ПРИСТИГА, щом двете отгоре
          са налице. Появата ѝ сама казва „готово, това е следващото".

          ═══ ЗАЩО ЛОГОТО Е КОПЧЕТО ═══

          Това е единственото действие на екрана, което харчи кредит. Дадем
          ли му формата на обикновено копче, то е поредното копче. Логото
          не прилича на нищо друго в приложението — не може да се сбърка,
          не може да се пропусне и превръща натискането в момент.

          Цената пише ПОД него. Копче, което взима пари, без да казва колко,
          се натиска веднъж и после не се вярва на нито едно. */}
      {ready && (
        <section ref={third} className="enter-rise mt-9">
          <div className="flex items-center gap-3">
            <StepBadge n={3} />
            <h2 className="text-[17px] font-semibold">Готово — пробвай</h2>
          </div>

          {/* ═══ ЗАЩО КОПЧЕТО Е НИСКО И ШИРОКО ═══

              Първата версия беше висок лаймов правоъгълник с логото малко в
              средата. Изглеждаше зле по две причини, и двете за пропорция:

              1. Логото е ШИРОКО (3:2). Сложено в почти квадратна подложка,
                 около него остава повече празно, отколкото самото лого — а
                 големите празни полета четат като недовършен макет.
              2. Подложката беше по-голяма от нужното и стана най-тежкото
                 нещо на екрана. Тя обаче е рамка на логото, не самостоятелна
                 форма.

              Сега подложката приляга на логото — тънък кант около него, а не
              поле. Ъглите са различни четири и е леко наклонено: същото
              изрязано парче, от което е сглобено самото лого. Отдолу има
              плътна лаймово-тъмна „дебелина", която при натискане се свива.
              Това е ФИЗИКА, не украса: копче, което потъва, се усеща като
              натиснато. */}
          <div className="mt-4 flex flex-col items-center">
            <button
              type="button"
              onClick={() => void start()}
              disabled={starting}
              aria-label="Генерирай пробата"
              className={cn(
                'group relative block w-[262px] max-w-full',
                'transition-transform duration-[var(--dur-press)] ease-[var(--ease-out)]',
                starting ? 'opacity-60' : 'active:translate-y-[3px]',
              )}
            >
              <span
                className={cn(
                  'tx-knit relative block -rotate-[1.5deg] px-[18px] py-3.5',
                  'rounded-[26px_16px_28px_14px] ring-[5px] ring-ink',
                  'shadow-[0_7px_0_var(--color-lime-deep),0_16px_26px_-14px_rgba(0,0,0,.5)]',
                  'transition-shadow duration-[var(--dur-press)] ease-[var(--ease-out)]',
                  'group-active:shadow-[0_4px_0_var(--color-lime-deep),0_8px_16px_-14px_rgba(0,0,0,.5)]',
                )}
              >
                <Logo tight width={222} className="mx-auto block" />

              </span>
            </button>

            <p className="mt-5 text-[13.5px] font-semibold">
              {starting ? (stage ?? 'Пускаме я...') : 'Натисни логото · 1 проба'}
            </p>
          </div>
        </section>
      )}

      {/* ── Настройките и състоянието ─────────────────────────────────────
          Зъбното колело е малко и тихо. То е настройка, не действие — и
          това трябва да си личи от разстояние, без да се чете. */}
      <div className="mt-8 flex items-center justify-center gap-3">
        <button
          aria-label="Настройки на генерирането"
          onClick={() => setSettingsOpen(true)}
          className="pressable grid size-12 shrink-0 place-items-center rounded-full bg-paper-2 text-ink-70"
        >
          <GearIcon />
        </button>

        {!ready && (
          <span className="text-[13.5px] text-ink-45">
            {!hasPhoto ? 'Първо качи своя снимка' : 'Сега избери дреха'}
          </span>
        )}
      </div>

      {error ? (
        <p className="enter-rise mt-3 text-center text-[13px] text-danger">{error}</p>
      ) : (
        <p className="mt-3 text-center text-[12.5px] text-ink-45">
          Имаш {credits} {credits === 1 ? 'проба' : 'проби'}.
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
