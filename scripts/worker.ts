/**
 * Процесът на работниците.
 *
 *   npm run worker
 *
 * Върви отделно от уеб приложението. В Docker това е втори контейнер от
 * същия образ, само с друга команда — нищо специфично за хостинга.
 *
 * ⚠ Без `await` на най-горно ниво: коренният package.json не е ESM модул и
 *   tsx компилира скриптовете като CommonJS. Всичко живее в `main()`.
 */

import { existsSync } from 'node:fs';
import process from 'node:process';
import { disconnectAll } from '@probvai/db';
import { startWorkers, stopWorkers } from '@probvai/core/worker';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

let stopping = false;

async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;

  console.info(`\n[worker] ${signal} — спирам кротко...`);
  try {
    await stopWorkers();
    await disconnectAll();
  } catch (error) {
    console.error('[worker] грешка при спиране:', error);
  }
  process.exit(0);
}

async function main(): Promise<void> {
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => void shutdown(signal));
  }

  process.on('unhandledRejection', (reason) => {
    console.error('[worker] необработена грешка:', reason);
  });

  await startWorkers();
  console.info('[worker] готов. Ctrl+C за спиране.');
}

main().catch((error: unknown) => {
  console.error('[worker] не успя да тръгне:', error);
  process.exit(1);
});
