/**
 * Временна страница. Интерфейсът се строи във Фаза 4, след като героят
 * от Фаза 3 е готов — той е централният елемент на менюто.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-3 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">ПРОБВАЙ</h1>
      <p className="text-sm text-neutral-600">
        Основата е готова. Интерфейсът идва във Фаза 4.
      </p>
      <a
        href="/api/health"
        className="text-sm text-neutral-400 underline underline-offset-4"
      >
        /api/health
      </a>
    </main>
  );
}
