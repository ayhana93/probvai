/**
 * Пуска производствения билд локално.
 *
 * `next start` не работи с `output: 'standalone'` — Next сам го казва.
 * Затова тук правим същото, което прави Dockerfile-ът: слагаме статичните
 * файлове до самостоятелния сървър и го пускаме.
 *
 * Смисълът е да пускаш локално точно това, което тръгва в контейнера.
 */

import { spawn } from 'node:child_process';
import { access, cp } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const buildDir = path.join(root, 'apps/web/.next');
const standalone = path.join(buildDir, 'standalone');

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(path.join(standalone, 'apps/web/server.js')))) {
  console.error('\n  ✗ Няма билд. Пусни първо: npm run build\n');
  process.exit(1);
}

// Статичните файлове не влизат в самостоятелния изход — копират се отделно.
await cp(path.join(buildDir, 'static'), path.join(standalone, 'apps/web/.next/static'), {
  recursive: true,
});

const publicDir = path.join(root, 'apps/web/public');
if (await exists(publicDir)) {
  await cp(publicDir, path.join(standalone, 'apps/web/public'), { recursive: true });
}

if (await exists(path.join(root, '.env'))) {
  process.loadEnvFile(path.join(root, '.env'));
}

const child = spawn(process.execPath, ['apps/web/server.js'], {
  cwd: standalone,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' },
});

child.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
