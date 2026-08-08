/**
 * ПРОФИЛ И НИВА
 *
 * Двете неща, които трябва да са невъзможни:
 *   • регистрация под допустимата възраст;
 *   • публичен гардероб на непълнолетен, дори когато е поискан изрично.
 *
 * И едно, което трябва да е вярно: VIP Closet се отключва при точния праг,
 * а не около него.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { dbSystem, disconnectAll } from '@probvai/db';
import {
  ageFromBirthYear,
  completeProfile,
  mayPublish,
  MIN_AGE,
  PUBLIC_WARDROBE_MIN_AGE,
} from '../src/profile';
import { rankFor, tierFrom, RANKS } from '../src/tier';
import { resetEnvCache } from '../src/env';

const system = dbSystem();
const createdUsers: string[] = [];

beforeAll(() => {
  process.env.VIP_THRESHOLD_EUR = '200';
  resetEnvCache();
});

async function makeUser(): Promise<string> {
  const user = await system.user.create({
    data: { email: `prof-${crypto.randomUUID()}@example.test` },
    select: { id: true },
  });
  createdUsers.push(user.id);
  return user.id;
}

afterEach(async () => {
  if (createdUsers.length > 0) {
    await system.user.deleteMany({ where: { id: { in: createdUsers } } });
    createdUsers.length = 0;
  }
});

afterAll(async () => {
  await disconnectAll();
});

// ---------------------------------------------------------------------------

describe('Довършване на профила', () => {
  it('записва петте полета и отбелязва регистрацията за завършена', async () => {
    const userId = await makeUser();

    const result = await completeProfile(userId, {
      firstName: '  Иван  ',
      lastName: 'Иванов',
      gender: 'MALE',
      age: 28,
      wardrobePublic: false,
    });

    expect(result).toMatchObject({ ok: true, publicRefused: false });

    const user = await system.user.findUniqueOrThrow({ where: { id: userId } });
    // Интервалите отпред и отзад падат — иначе после нищо не се сортира.
    expect(user.firstName).toBe('Иван');
    expect(user.gender).toBe('MALE');
    // Пази се ГОДИНАТА, не възрастта. Възраст, записана веднъж, остава
    // невярна завинаги.
    expect(user.birthYear).toBe(new Date().getFullYear() - 28);
    expect(user.profileCompletedAt).not.toBeNull();
    expect(user.name).toBe('Иван Иванов');
  });

  it('отказва под допустимата възраст', async () => {
    const userId = await makeUser();

    const result = await completeProfile(userId, {
      firstName: 'Иван',
      lastName: 'Иванов',
      gender: 'MALE',
      age: MIN_AGE - 1,
      wardrobePublic: false,
    });

    expect(result).toMatchObject({ ok: false, reason: 'TOO_YOUNG' });

    const user = await system.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.profileCompletedAt).toBeNull();
  });

  it('под 18 не получава публичен гардероб, дори да го е поискал', async () => {
    const userId = await makeUser();

    const result = await completeProfile(userId, {
      firstName: 'Иван',
      lastName: 'Иванов',
      gender: 'OTHER',
      age: PUBLIC_WARDROBE_MIN_AGE - 1,
      wardrobePublic: true,
    });

    // Профилът се записва, но изборът се отменя — и това се КАЗВА,
    // вместо да се премълчи.
    expect(result).toMatchObject({ ok: true, publicRefused: true });

    const user = await system.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.wardrobePublic).toBe(false);
  });

  it('празни и къси имена не минават', async () => {
    const userId = await makeUser();

    for (const firstName of ['', ' ', 'И', null, 42]) {
      expect(
        await completeProfile(userId, {
          firstName,
          lastName: 'Иванов',
          gender: 'MALE',
          age: 30,
          wardrobePublic: false,
        }),
      ).toMatchObject({ ok: false, reason: 'BAD_FIRST_NAME' });
    }
  });

  it('измислен пол не минава', async () => {
    const userId = await makeUser();

    expect(
      await completeProfile(userId, {
        firstName: 'Иван',
        lastName: 'Иванов',
        gender: 'РОБОТ',
        age: 30,
        wardrobePublic: false,
      }),
    ).toMatchObject({ ok: false, reason: 'BAD_GENDER' });
  });
});

describe('Право на публикуване', () => {
  it('иска и публичен гардероб, и навършени 18', () => {
    const year = new Date().getFullYear();

    expect(mayPublish({ wardrobePublic: true, birthYear: year - 25 })).toBe(true);
    expect(mayPublish({ wardrobePublic: false, birthYear: year - 25 })).toBe(false);
    expect(mayPublish({ wardrobePublic: true, birthYear: year - 15 })).toBe(false);
    // Без записана година не публикуваме. Отказът по подразбиране е
    // правилният отказ.
    expect(mayPublish({ wardrobePublic: true, birthYear: null })).toBe(false);
  });

  it('възрастта се смята от годината, не се пази', () => {
    expect(ageFromBirthYear(new Date().getFullYear() - 30)).toBe(30);
    expect(ageFromBirthYear(null)).toBeNull();
  });
});

describe('Нива и VIP Closet', () => {
  it('стълбицата се качва с точките', () => {
    expect(rankFor(0).title).toBe('Newbie Stylist');
    expect(rankFor(9).title).toBe('Newbie Stylist');
    expect(rankFor(10).title).toBe('Fashion Lover');
    expect(rankFor(74).title).toBe('Trend Hunter');
    expect(rankFor(75).title).toBe('Style Expert');
    expect(rankFor(1000).title).toBe('Fashion Icon');
  });

  it('прагът на всяко ниво е по-висок от предишния', () => {
    for (let i = 1; i < RANKS.length; i += 1) {
      expect(RANKS[i]!.from).toBeGreaterThan(RANKS[i - 1]!.from);
    }
  });

  it('VIP Closet се отключва точно на прага, не около него', () => {
    // €199.99 не е €200. Прагът е в центове точно затова.
    expect(tierFrom(0, 19_999).vip).toBe(false);
    expect(tierFrom(0, 20_000).vip).toBe(true);
    expect(tierFrom(0, 20_001).vip).toBe(true);
  });

  it('казва колко остава до следващото ниво и до VIP', () => {
    const state = tierFrom(20, 5_000);

    expect(state.rank.title).toBe('Fashion Lover');
    expect(state.next?.title).toBe('Trend Hunter');
    expect(state.toNext).toBe(10);
    expect(state.spentEur).toBe('50.00');
    expect(state.toVipEur).toBe('150.00');
  });

  it('на върха на стълбицата няма „следващо"', () => {
    const state = tierFrom(500, 0);
    expect(state.next).toBeNull();
    expect(state.toNext).toBe(0);
    expect(state.progressPct).toBe(100);
  });
});
