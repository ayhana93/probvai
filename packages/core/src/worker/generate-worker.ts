/**
 * РАБОТНИКЪТ — прави самата генерация.
 *
 * Върви в отделен процес от уеб приложението. Причината: една генерация
 * отнема 20–60 секунди, а уеб процесът трябва да отговаря веднага.
 *
 * ═══ ЗАЩО ЗАДАЧАТА МОЖЕ ДА СЕ ПОВТОРИ БЕЗОПАСНО ═══
 *
 * pg-boss връща задачата в опашката, ако работникът умре. Ако при повторното
 * ѝ хващане просто извикахме доставчика пак, щяхме да платим два пъти за
 * една генерация. Затова: щом `providerJobId` вече е записан, НЕ пускаме нова
 * задача при доставчика, а продължаваме да полваме старата.
 */

import { dbSystem } from '@probvai/db';
import { failGeneration } from '../generation';
import { env } from '../env';
import { safeFetch } from '../net-guard';
import { providerByName, ProviderError, type ProviderName } from '../providers';
import { buildKey, getSignedUrl, putObject } from '../storage';
import { categorize } from '../style';
import { awardXp } from '../tier';
import { applyWatermark, shouldWatermark } from '../watermark';

const POLL_INTERVAL_MS = 2_000;

/** Максимален размер на резултата от доставчика. */
const RESULT_MAX_BYTES = 25 * 1024 * 1024;

export type GenerateJob = { generationId: string };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Сваля резултата. Доставчикът връща или `data:` URI (при return_base64),
 * или адрес към своя CDN.
 */
async function downloadResult(imageUrl: string): Promise<Uint8Array> {
  if (imageUrl.startsWith('data:')) {
    const comma = imageUrl.indexOf(',');
    if (comma === -1) throw new Error('Развален data URI от доставчика');

    const meta = imageUrl.slice(0, comma);
    const payload = imageUrl.slice(comma + 1);

    if (!meta.includes(';base64')) {
      return new TextEncoder().encode(decodeURIComponent(payload));
    }
    return new Uint8Array(Buffer.from(payload, 'base64'));
  }

  // Адресът идва от доставчика, не от потребител — но пак минава през
  // проверената функция. Защитата в дълбочина не струва нищо тук.
  const response = await safeFetch(imageUrl, {
    timeoutMs: 30_000,
    maxBytes: RESULT_MAX_BYTES,
    accept: 'image/*',
    allowedContentTypes: ['image/', 'application/octet-stream'],
  });

  return response.body;
}

/**
 * Обработва една задача от опашката.
 *
 * Хвърли ли, pg-boss ще опита пак. Върне ли нормално, задачата е приключила —
 * успешно или с отбелязан провал.
 */
export async function runGenerationJob(job: GenerateJob): Promise<void> {
  const system = dbSystem();
  const { generationId } = job;

  const generation = await system.generation.findUnique({
    where: { id: generationId },
    select: {
      id: true,
      userId: true,
      status: true,
      provider: true,
      providerJobId: true,
      personKey: true,
      garmentKey: true,
      aspectRatio: true,
      prompt: true,
      merchant: true,
      productUrl: true,
      category: true,
      categoryLocked: true,
    },
  });

  if (!generation) {
    console.warn(`[worker] генерация ${generationId} я няма — пропускам`);
    return;
  }

  // Вече приключила задача не се прави втори път.
  if (generation.status !== 'QUEUED' && generation.status !== 'RUNNING') {
    console.info(`[worker] ${generationId} е ${generation.status} — пропускам`);
    return;
  }

  const provider = providerByName(generation.provider as ProviderName);
  const startedAt = Date.now();
  const deadline = startedAt + env.GENERATION_TIMEOUT_SECONDS * 1000;

  try {
    await system.generation.update({
      where: { id: generationId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    // ── 1. Пускане при доставчика ────────────────────────────────────────
    let jobId = generation.providerJobId;

    if (!jobId) {
      const personUrl = await getSignedUrl(generation.personKey);
      const garmentUrl = await getSignedUrl(generation.garmentKey);

      const started = await provider.run({
        personUrl,
        garmentUrl,
        aspectRatio: generation.aspectRatio as never,
        prompt: generation.prompt,
      });
      jobId = started.jobId;

      // Записва се веднага. Ако процесът умре след това, повторното хващане
      // ще продължи да полва, вместо да плати втори път.
      await system.generation.update({
        where: { id: generationId },
        data: { providerJobId: jobId },
      });
    } else {
      console.info(`[worker] ${generationId} продължава стара задача ${jobId}`);
    }

    // ── 2. Полване до готово ─────────────────────────────────────────────
    let imageUrl: string | undefined;

    for (;;) {
      if (Date.now() > deadline) {
        await failGeneration(generationId, 'TIMEOUT');
        console.warn(`[worker] ${generationId} не се събра в отреденото време`);
        return;
      }

      const result = await provider.poll(jobId);

      if (result.status === 'done' && result.imageUrl) {
        imageUrl = result.imageUrl;
        break;
      }
      if (result.status === 'failed') {
        await failGeneration(generationId, result.errorCode ?? 'PROVIDER_FAILED');
        console.warn(`[worker] ${generationId} се провали: ${result.detail ?? ''}`);
        return;
      }

      await sleep(POLL_INTERVAL_MS);
    }

    // ── 3. Сваляне, воден знак, качване ──────────────────────────────────
    const raw = await downloadResult(imageUrl);

    const watermarked = await shouldWatermark(generation.userId);
    const finalImage = watermarked ? await applyWatermark(raw) : Buffer.from(raw);

    const resultKey = buildKey(generation.userId, 'result', 'jpg');
    await putObject(resultKey, finalImage, 'image/jpeg');

    // ── 4. Категория ─────────────────────────────────────────────────────
    // Слага се тук, а не при заявката: чак сега знаем, че визията е готова
    // и има какво да се подрежда. Ако човекът вече я е сменил ръчно
    // (`categoryLocked`), не я пипаме — неговият избор бие нашия.
    const category = generation.categoryLocked
      ? generation.category
      : categorize({
          title: generation.merchant,
          productUrl: generation.productUrl,
        });

    await system.generation.update({
      where: { id: generationId },
      data: {
        status: 'DONE',
        resultKey,
        watermarked,
        category,
        completedAt: new Date(),
      },
    });

    // Точката се дава за ГОТОВА визия. Провалената връща кредита и не бива
    // да качва нивото — иначе нивата растат от нашите грешки.
    await awardXp(generation.userId);

    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.info(
      `[worker] ${generationId} готова за ${seconds}с · ` +
        `доставчик ${provider.name} · $${provider.costUSD} · ` +
        `воден знак: ${watermarked ? 'да' : 'не'}`,
    );
  } catch (error) {
    const code =
      error instanceof ProviderError ? error.code : 'INTERNAL';

    console.error(`[worker] ${generationId} гръмна (${code}):`, error);
    await failGeneration(generationId, code);

    // Не хвърляме нататък: провалът е отбелязан и кредитът е върнат.
    // Повторен опит само би харчил време — а при `PROVIDER_AUTH` и
    // `PROVIDER_BAD_REQUEST` няма и смисъл.
  }
}
