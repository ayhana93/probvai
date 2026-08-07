/**
 * Стартиране и спиране на работниците.
 *
 * Ползва се от `scripts/worker.ts` и от тестовете.
 */

import { getBoss, QUEUES, stopBoss } from '../queue';
import { runGenerationJob, type GenerateJob } from './generate-worker';

export { runGenerationJob } from './generate-worker';
export type { GenerateJob } from './generate-worker';

/**
 * Закача работниците към опашките.
 *
 * `batchSize: 1` нарочно: една генерация държи процеса зает десетки секунди
 * и няма смисъл да хващаме няколко наведнъж. Паралелността се вдига с още
 * процеси, не с по-голям batch.
 */
export async function startWorkers(): Promise<void> {
  const boss = await getBoss();

  await boss.work<GenerateJob>(
    QUEUES.GENERATE,
    { batchSize: 1, pollingIntervalSeconds: 1 },
    async ([job]) => {
      if (!job) return;
      await runGenerationJob(job.data);
    },
  );

  console.info(`[worker] слушам опашка "${QUEUES.GENERATE}"`);
}

export async function stopWorkers(): Promise<void> {
  await stopBoss();
}
