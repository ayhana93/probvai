/**
 * РЕЗУЛТАТЪТ
 *
 * Наградата. Снимката изкача в рамка от езика на приложението и заема
 * каквото ѝ трябва; всичко останало се свива под нея.
 *
 * ═══ ГЛАВНОТО КОПЧЕ Е „ЗАПАЗИ" ═══
 *
 * То прави две неща с едно натискане: сваля снимката в галерията на
 * телефона и я отбелязва в гардероба. Две отделни копчета за това биха
 * били по-„честни" технически и по-лоши на практика — човек, който е
 * свалил снимката, винаги я иска и в гардероба.
 *
 * ═══ ПОДРЕДБАТА НА ОСТАНАЛИТЕ НЕ Е ПО АЗБУЧЕН РЕД ═══
 *
 *   Сподели      — основният ни канал за растеж.
 *   В Lookbook   — само при публичен гардероб. Публикува се ЕДНА визия, с
 *                  изрично натискане; отметката от регистрацията дава само
 *                  правото.
 *   Опитай пак   — харчи кредит, затова цената е ИЗПИСАНА на копчето.
 *                  Копче, което взима пари без да предупреди, се натиска
 *                  веднъж и после никой не вярва на нито едно.
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { PhotoViewer } from '@/components/photo-viewer';
import { RecoBlocks, type RecoBlockView } from '@/components/reco-blocks';
import { Button } from '@/components/ui/button';
import { LookFrame } from '@/components/ui/look-frame';
import { RetryIcon, SaveIcon, ShareIcon } from '@/components/ui/icons';
import { Sparks } from '@/components/ui/scribble';
import { STYLE_LABELS, type StyleKey } from '@/lib/styles';
import { R } from '@/lib/routes';

export type ResultViewProps = {
  generationId: string;
  resultUrl: string;
  watermarked: boolean;
  /** Име на магазин има само при генерация от линк. */
  merchant?: string | null;
  category?: StyleKey | null;
  saved?: boolean;
  published?: boolean;
  /** Може ли изобщо да публикува — зависи от публичния гардероб. */
  canPublish?: boolean;
  recommendations?: RecoBlockView[];
  onRetry?: () => void;
};

type SaveState = 'idle' | 'working' | 'done' | 'failed';
type ShareState = 'idle' | 'working' | 'saved' | 'failed';

export function ResultView({
  generationId,
  resultUrl,
  watermarked,
  merchant,
  category,
  saved = false,
  published = false,
  canPublish = false,
  recommendations = [],
  onRetry,
}: ResultViewProps) {
  const [share, setShare] = React.useState<ShareState>('idle');
  const [save, setSave] = React.useState<SaveState>(saved ? 'done' : 'idle');
  const [isPublished, setPublished] = React.useState(published);
  const [publishError, setPublishError] = React.useState<string | null>(null);
  const [zoomed, setZoomed] = React.useState(false);

  /**
   * Запазване: сваляне в телефона + отметка в гардероба.
   *
   * Свалянето става ПЪРВО. То е това, което човекът вижда; ако мрежата
   * падне на втората стъпка, снимката вече е в телефона му.
   */
  const onSave = React.useCallback(async () => {
    setSave('working');
    try {
      /**
       * ═══ ДВЕ ГРЕШКИ БЯХА ТУК ═══
       *
       * 1. Сваляше се от `resultUrl` — подписаният адрес на R2. Това е друг
       *    домейн, а R2 не праща `Access-Control-Allow-Origin`, тоест
       *    `fetch` умираше в CORS. Показването работеше, защото `<img src>`
       *    не минава през CORS — затова счупено беше само свалянето.
       *
       *    Сега файлът идва от нашия домейн: `/api/generate/{id}/file`.
       *
       * 2. `<a download>` не слага снимка в галерията на iPhone. Там няма
       *    как да се пише в „Снимки" от уеб страница — освен през листа за
       *    споделяне, в който стои „Save Image".
       *
       *    Затова, ако телефонът може да сподели файл, отваря се листът.
       *    Копчето продължава да казва „Запази в галерията", защото това е
       *    какво прави ЧОВЕКЪТ с него; през кой лист минава е наша работа.
       */
      const response = await fetch(`/api/generate/${generationId}/file`);
      if (!response.ok) throw new Error('няма снимка');

      const blob = await response.blob();
      const file = new File([blob], `probvai-${generationId}.jpg`, { type: 'image/jpeg' });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'ПРОБВАЙ' });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        link.click();
        URL.revokeObjectURL(url);
      }

      // Отметката. Провалът ѝ не проваля свалянето — затова е в свой опит.
      try {
        await fetch(`/api/generate/${generationId}/save`, { method: 'POST' });
      } catch {
        // Снимката е в телефона. Отметката ще се сложи при следващо влизане.
      }

      setSave('done');
    } catch (error) {
      // Отказан лист за споделяне НЕ е грешка — човекът е размислил.
      // Без тази проверка всяко „Cancel" се показваше като „Не се свали".
      if (error instanceof DOMException && error.name === 'AbortError') {
        setSave('idle');
        return;
      }
      setSave('failed');
    }
  }, [generationId]);

  /**
   * Споделяне: първо Web Share API с файла, после сваляне.
   *
   * Проверката е `canShare({ files })`, не `share` — Android има `share`,
   * но не всеки браузър приема файлове. Без тази проверка човек вижда
   * грешка вместо картинка.
   */
  const onShare = React.useCallback(async () => {
    setShare('working');
    try {
      const response = await fetch(`/api/generate/${generationId}/share`);
      if (!response.ok) throw new Error('няма готова картинка');

      const blob = await response.blob();
      const file = new File([blob], `probvai-${generationId}.jpg`, { type: 'image/jpeg' });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'ПРОБВАЙ' });
        setShare('idle');
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
      setShare('saved');
    } catch {
      setShare('failed');
    }
  }, [generationId]);

  const onPublish = React.useCallback(async () => {
    const next = !isPublished;
    setPublished(next);
    setPublishError(null);

    try {
      const response = await fetch(`/api/generate/${generationId}/publish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ published: next }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: { message?: string } };
        setPublished(!next);
        setPublishError(data.error?.message ?? 'Не се получи.');
      }
    } catch {
      setPublished(!next);
      setPublishError('Няма връзка.');
    }
  }, [generationId, isPublished]);

  const style = category ? STYLE_LABELS[category] : null;

  return (
    <main className="px-4 pb-8 pt-4">
      {/* Натискането отваря снимката на цял екран. Рамката е за списъка и
          за споделянето; когато се разглежда, тя само пречи. */}
      <LookFrame
        src={resultUrl}
        alt="Готовата проба"
        badge={style ? `${style.emoji} ${style.label}` : undefined}
        note={merchant ?? undefined}
        onClick={() => setZoomed(true)}
      />

      {zoomed && <PhotoViewer src={resultUrl} onClose={() => setZoomed(false)} />}

      {/* ── Главното действие ─────────────────────────────────────────────
          Едно широко лаймово копче. То е и свалянето, и гардеробът. */}
      <div className="mt-5">
        <Button
          variant="action"
          size="lg"
          block
          busy={save === 'working'}
          onClick={() => void onSave()}
        >
          <SaveIcon />
          {save === 'working'
            ? 'Запазваме...'
            : save === 'done'
              ? 'Запазена'
              : 'Запази в галерията'}
        </Button>

        <p className="mt-2 text-center text-[12.5px] text-ink-45">
          {save === 'done'
            ? 'Свалена е в телефона ти и стои в гардероба.'
            : save === 'failed'
              ? 'Не се свали. Пробвай пак.'
              : 'Сваля се в телефона ти и влиза в гардероба.'}
        </p>
      </div>

      {/* ── Водният знак ──────────────────────────────────────────────────
          Не се извинява и не обяснява защо го има. Казва какво се печели
          и води на едно натискане разстояние от касата. */}
      {watermarked && (
        <Link
          href={R.credits}
          className="pressable mt-4 flex items-center justify-between rounded-[var(--radius-card)] bg-violet-wash px-4 py-3.5"
        >
          <span className="flex items-center gap-2">
            <Sparks className="h-4 w-6 text-violet" />
            <span className="text-[14px] font-semibold">Махни водния знак</span>
          </span>
          <span className="text-[13px] text-ink-45">Зареди кредити ›</span>
        </Link>
      )}

      {/* ── Второстепенните действия ──────────────────────────────────────── */}
      <div className="mt-4 flex gap-2.5">
        <Button
          variant="ink"
          size="md"
          className="flex-1"
          busy={share === 'working'}
          onClick={() => void onShare()}
        >
          <ShareIcon />
          {share === 'working' ? 'Готви се...' : 'Сподели'}
        </Button>

        <Button variant="quiet" size="md" className="flex-1" onClick={onRetry}>
          <RetryIcon />
          Пак · 1 кредит
        </Button>
      </div>

      {share === 'saved' && (
        <p className="enter-rise mt-2 text-center text-[13px] text-ink-45">
          Свалена е в телефона ти.
        </p>
      )}
      {share === 'failed' && (
        <p className="enter-rise mt-2 text-center text-[13px] text-danger">
          Не се получи. Пробвай пак след малко.
        </p>
      )}

      {/* ── Lookbook ───────────────────────────────────────────────────────
          Само за хора с публичен гардероб. На останалите не показваме
          копче, което ще ги откаже — показваме къде се включва. */}
      {canPublish ? (
        <button
          onClick={() => void onPublish()}
          className="pressable mt-4 flex w-full items-center justify-between rounded-[var(--radius-card)] bg-paper-2 px-4 py-3.5 text-left"
        >
          <span>
            <span className="text-[14px] font-semibold">
              {isPublished ? 'Махни от Lookbook' : 'Покажи в Lookbook'}
            </span>
            <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-45">
              {isPublished
                ? 'Виждат я всички. Махането е веднага.'
                : 'Само тази визия. Гардеробът остава твой.'}
            </span>
          </span>
          <span aria-hidden="true" className="text-[18px]">
            {isPublished ? '✓' : '✨'}
          </span>
        </button>
      ) : null}

      {publishError && (
        <p className="enter-rise mt-2 text-center text-[13px] text-danger">{publishError}</p>
      )}

      <RecoBlocks blocks={recommendations} />
    </main>
  );
}
