/**
 * Row Level Security — свързването между Prisma и политиките в Postgres.
 *
 * Postgres не знае кой е влезлият потребител. Политиките четат стойността
 * `app.current_user_id` от текущата сесия, а тя се задава от нас с
 * `set_config(..., TRUE)` — третият аргумент `TRUE` значи „само за тази
 * транзакция“, тоест стойността не изтича към следващата заявка на същата
 * връзка от пула.
 *
 * Затова всяка заявка от името на потребител трябва да е в транзакция.
 * Това е цената на реалния RLS: две обръщения към базата вместо едно.
 */

import type { PrismaClient } from './generated/prisma';
import { Prisma } from './generated/prisma';

/** Име на GUC променливата. Трябва да съвпада с миграцията за RLS. */
export const CURRENT_USER_SETTING = 'app.current_user_id';

/**
 * Задава текущия потребител вътре в отворена транзакция.
 * Ползва се от `txAsUser`, когато пишем няколко заявки в една транзакция.
 */
export function setCurrentUser(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<number> {
  return tx.$executeRaw`SELECT set_config(${CURRENT_USER_SETTING}, ${userId}, TRUE)`;
}

/**
 * Обвива Prisma клиент така, че всяка заявка към модел да се изпълнява в
 * транзакция, в която `app.current_user_id` е зададен.
 *
 * Резултатът вижда САМО редовете на този потребител — не защото кодът
 * филтрира, а защото базата не връща останалите.
 */
export function withUser(client: PrismaClient, userId: string) {
  if (!userId) {
    throw new Error('withUser: липсва userId — това би отворило достъп до чужди редове');
  }

  return client.$extends({
    name: 'rls-current-user',
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await client.$transaction([
            client.$executeRaw`SELECT set_config(${CURRENT_USER_SETTING}, ${userId}, TRUE)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}

export type UserScopedClient = ReturnType<typeof withUser>;
