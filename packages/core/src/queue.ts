/**
 * ОПАШКА — pg-boss в същата Postgres база.
 *
 * Без Redis нарочно: една база по-малко за поддръжка, една услуга по-малко
 * при местене на друг хостинг.
 *
 * pg-boss се свързва с ролята `app_system` — тя има CREATE върху базата,
 * защото pg-boss си създава собствена схема при първо стартиране.
 */

import PgBoss from 'pg-boss';

/** Имената на опашките. Държим ги на едно място, за да няма разминаване. */
export const QUEUES = {
  /** Една генерация: викане на доставчика, полване, воден знак, качване. */
  GENERATE: 'generate',
  /** Ежедневно чистене на изображения след 90 дни неактивност. */
  CLEANUP_INACTIVE: 'cleanup-inactive',
  /** Предупредителни имейли на ден 76 и 87. */
  INACTIVITY_WARNING: 'inactivity-warning',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

let instance: PgBoss | undefined;
let starting: Promise<PgBoss> | undefined;

function connectionString(): string {
  const url = process.env.DATABASE_URL_SYSTEM ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Липсва DATABASE_URL_SYSTEM — pg-boss няма към какво да се свърже.');
  }
  return url;
}

/**
 * Стартира pg-boss веднъж и връща същата инстанция при всяко следващо
 * извикване. Опашките се създават явно — pg-boss 10 не ги прави сам.
 */
export async function getBoss(): Promise<PgBoss> {
  if (instance) return instance;
  if (starting) return starting;

  starting = (async () => {
    const boss = new PgBoss({
      connectionString: connectionString(),
      // Схемата е отделна, за да не се смесва с нашите таблици.
      schema: 'pgboss',
    });

    boss.on('error', (error) => {
      console.error('[pg-boss]', error);
    });

    await boss.start();

    for (const name of Object.values(QUEUES)) {
      await boss.createQueue(name);
    }

    instance = boss;
    return boss;
  })();

  return starting;
}

/** Спира опашката. Ползва се при спиране на процеса и в тестовете. */
export async function stopBoss(): Promise<void> {
  if (!instance) return;
  await instance.stop({ graceful: true });
  instance = undefined;
  starting = undefined;
}
