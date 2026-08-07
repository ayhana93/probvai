import { existsSync } from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';

// Монорепо: `.env` живее в корена, а Next търси в своята папка.
// В Docker и на хостинга променливите идват от средата и този блок не прави нищо.
const rootEnv = path.join(import.meta.dirname, '../../.env');
if (existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Изходът е самостоятелен пакет — Docker образът остава малък и не носи
  // целия node_modules. Нищо специфично за Railway (правило №1).
  output: 'standalone',

  // Монорепо: проследяването на файлове тръгва от корена, за да хване
  // packages/db и packages/core.
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),

  // Вътрешните пакети се доставят като TypeScript и се компилират от Next.
  transpilePackages: ['@probvai/core', '@probvai/db'],

  // Пакети с нативни части — Next не бива да ги бъндълва.
  serverExternalPackages: ['@prisma/client', 'pg-boss', 'sharp', 'undici'],

  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
