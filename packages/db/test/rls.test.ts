/**
 * Доказателство, че Row Level Security работи.
 *
 * Тестът НЕ проверява дали политиките съществуват — проверява дали базата
 * реално отказва. Разликата има значение: политика с грешен израз
 * съществува и не пази нищо.
 *
 * Покрива две точки от контролния списък преди пускане:
 *   • Потребител A не вижда генерация на потребител B
 *   • RLS е активен на всяка таблица с потребителски данни
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dbSystem, dbAsUser, disconnectAll } from '../src/index';

const system = dbSystem();

let userA: string;
let userB: string;

const stamp = Date.now();

beforeAll(async () => {
  const a = await system.user.create({
    data: { email: `rls-a-${stamp}@example.test`, name: 'Ана', credits: 10 },
  });
  const b = await system.user.create({
    data: { email: `rls-b-${stamp}@example.test`, name: 'Борислава', credits: 10 },
  });

  userA = a.id;
  userB = b.id;

  await system.generation.createMany({
    data: [
      {
        userId: userA,
        provider: 'fashn_tryon_max',
        personKey: 'users/a/person/1.jpg',
        garmentKey: 'users/a/garment/1.jpg',
      },
      {
        userId: userB,
        provider: 'fashn_tryon_max',
        personKey: 'users/b/person/1.jpg',
        garmentKey: 'users/b/garment/1.jpg',
      },
    ],
  });

  await system.creditLedger.createMany({
    data: [
      { userId: userA, delta: 10, reason: 'SIGNUP', balance: 10 },
      { userId: userB, delta: 10, reason: 'SIGNUP', balance: 10 },
    ],
  });
});

afterAll(async () => {
  await system.user.deleteMany({ where: { id: { in: [userA, userB] } } });
  await disconnectAll();
});

describe('RLS — изолация между потребители', () => {
  it('вижда само своя ред в users', async () => {
    const rows = await dbAsUser(userA).user.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(userA);
  });

  it('не намира чужд потребител дори по точно id', async () => {
    const other = await dbAsUser(userA).user.findUnique({ where: { id: userB } });
    expect(other).toBeNull();
  });

  it('вижда само своите генерации', async () => {
    const mine = await dbAsUser(userA).generation.findMany();
    expect(mine).toHaveLength(1);
    expect(mine[0]?.userId).toBe(userA);
  });

  it('не вижда чужда генерация по точно id', async () => {
    const target = await system.generation.findFirstOrThrow({ where: { userId: userB } });
    const stolen = await dbAsUser(userA).generation.findUnique({ where: { id: target.id } });
    expect(stolen).toBeNull();
  });

  it('вижда само своя кредитен леджер', async () => {
    const rows = await dbAsUser(userA).creditLedger.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(userA);
  });

  it('не може да изтрие чужда генерация', async () => {
    const target = await system.generation.findFirstOrThrow({ where: { userId: userB } });
    const removed = await dbAsUser(userA).generation.deleteMany({ where: { id: target.id } });
    expect(removed.count).toBe(0);

    const stillThere = await system.generation.findUnique({ where: { id: target.id } });
    expect(stillThere).not.toBeNull();
  });
});

describe('RLS — кредитите се пипат само през app_system', () => {
  it('app_user не може да си вдигне баланса', async () => {
    await expect(
      dbAsUser(userA).user.update({ where: { id: userA }, data: { credits: 9999 } }),
    ).rejects.toThrow();

    const after = await system.user.findUniqueOrThrow({ where: { id: userA } });
    expect(after.credits).toBe(10);
  });

  it('app_user не може да пише в кредитния леджер', async () => {
    await expect(
      dbAsUser(userA).creditLedger.create({
        data: { userId: userA, delta: 500, reason: 'ADMIN', balance: 510 },
      }),
    ).rejects.toThrow();
  });

  it('но може да си смени името', async () => {
    const updated = await dbAsUser(userA).user.update({
      where: { id: userA },
      data: { name: 'Ана Петрова' },
    });
    expect(updated.name).toBe('Ана Петрова');
  });
});

describe('RLS — системните таблици са недостъпни за приложението', () => {
  it('не чете обработените Stripe събития', async () => {
    await expect(dbAsUser(userA).processedWebhook.findMany()).rejects.toThrow();
  });

  it('не чете одитния лог на админа', async () => {
    await expect(dbAsUser(userA).adminAuditLog.findMany()).rejects.toThrow();
  });

  it('не чете отпечатъците на устройствата', async () => {
    await expect(dbAsUser(userA).deviceFingerprint.findMany()).rejects.toThrow();
  });

  it('не чете изтритите самоличности', async () => {
    await expect(dbAsUser(userA).deletedIdentity.findMany()).rejects.toThrow();
  });

  it('не чете токените за вход', async () => {
    await expect(dbAsUser(userA).verificationToken.findMany()).rejects.toThrow();
  });
});

describe('RLS — отказът по подразбиране', () => {
  it('без зададен потребител базата не връща нито един ред', async () => {
    // Симулира пропуснат `set_config` — заявка направо по app_user връзката.
    const raw = await dbAsUser(userA).$queryRawUnsafe<{ count: bigint }[]>(
      'SELECT count(*)::bigint AS count FROM users',
    );
    // $queryRaw не минава през разширението за RLS, значи
    // app.current_user_id не е зададен и политиката не пуска нищо.
    expect(Number(raw[0]?.count ?? -1)).toBe(0);
  });
});
