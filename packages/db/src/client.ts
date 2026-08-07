/**
 * Prisma клиенти — по един на DB роля.
 *
 * Четири роли, четири различни връзки. Това е основата на изолацията:
 * ако потребителското приложение бъде пробито, ролята, с която то се свързва,
 * физически няма права върху таблиците за плащания и одит.
 *
 *   DATABASE_URL          probvai_migrator  само за миграции, не се ползва по време на работа
 *   DATABASE_URL_APP      app_user          заявки от името на потребител, RLS реже редовете
 *   DATABASE_URL_SYSTEM   app_system        Auth.js, webhook-ове, работници, cron
 *   DATABASE_URL_ADMIN    app_admin         админ панелът (Фаза 7)
 *
 * Клиентите се създават лениво — приложение, което не ползва админската
 * връзка, никога не отваря пул към нея.
 */

import { PrismaClient, Prisma } from './generated/prisma';
import { setCurrentUser, withUser, type UserScopedClient } from './rls';

export { Prisma, PrismaClient };
export type { UserScopedClient };

type Role = 'app' | 'system' | 'admin';

const ENV_BY_ROLE: Record<Role, string> = {
  app: 'DATABASE_URL_APP',
  system: 'DATABASE_URL_SYSTEM',
  admin: 'DATABASE_URL_ADMIN',
};

function connectionStringFor(role: Role): string {
  const name = ENV_BY_ROLE[role];
  const url = process.env[name];
  if (url) return url;

  // В производствен режим липсваща връзка е грешка, а не повод за отстъпка.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `Липсва ${name}. Всяка DB роля има собствена връзка — виж .env.example.`,
    );
  }

  const fallback = process.env.DATABASE_URL;
  if (!fallback) {
    throw new Error(`Липсва ${name} и няма DATABASE_URL за отстъпка.`);
  }

  console.warn(
    `[db] ${name} липсва — ползвам DATABASE_URL. ВНИМАНИЕ: RLS няма да се тества реално.`,
  );
  return fallback;
}

function createClient(role: Role): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: connectionStringFor(role) } },
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  });
}

// Next.js презарежда модулите при всяка промяна в режим на разработка.
// Без този кеш всяко презареждане отваря нов пул и базата свършва връзките.
const globalForPrisma = globalThis as unknown as {
  __probvaiClients?: Partial<Record<Role, PrismaClient>>;
};

function client(role: Role): PrismaClient {
  const cache = (globalForPrisma.__probvaiClients ??= {});
  return (cache[role] ??= createClient(role));
}

/**
 * Връзка за вътрешни задачи: Auth.js адаптерът, Stripe webhook-овете,
 * работниците на pg-boss, cron задачите. Заобикаля RLS по политика,
 * но няма достъп до одитния лог на админа.
 */
export function dbSystem(): PrismaClient {
  return client('system');
}

/**
 * Връзка за админ панела. Ползва се САМО в apps/admin.
 */
export function dbAdmin(): PrismaClient {
  return client('admin');
}

/**
 * Заявки от името на потребител. Всяка заявка минава през транзакция,
 * в която е зададен `app.current_user_id`, и RLS реже чуждите редове.
 *
 *   const db = dbAsUser(session.user.id);
 *   const mine = await db.generation.findMany();  // само моите
 */
export function dbAsUser(userId: string): UserScopedClient {
  return withUser(client('app'), userId);
}

/**
 * Няколко заявки в ЕДНА транзакция от името на потребител.
 * Ползва се, когато трябва атомарност — например четене и запис заедно.
 */
export function txAsUser<T>(
  userId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { timeout?: number; maxWait?: number; isolationLevel?: Prisma.TransactionIsolationLevel },
): Promise<T> {
  return client('app').$transaction(async (tx) => {
    await setCurrentUser(tx, userId);
    return fn(tx);
  }, options);
}

/**
 * Затваря всички отворени пулове. Ползва се в тестовете и при спиране
 * на работниците.
 */
export async function disconnectAll(): Promise<void> {
  const cache = globalForPrisma.__probvaiClients ?? {};
  await Promise.all(Object.values(cache).map((c) => c?.$disconnect()));
  globalForPrisma.__probvaiClients = {};
}
