import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/test/**/*.test.ts', 'apps/**/test/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],

    // Тестовете пипат една и съща база. Пускаме ги последователно, за да не
    // си пречат — иначе резултатите зависят от подредбата.
    fileParallelism: false,

    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
