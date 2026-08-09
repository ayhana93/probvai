/**
 * ПРОФИЛЪТ — това, което се пита веднъж, при регистрация.
 *
 * Име, фамилия, пол, възраст и дали гардеробът е публичен. Пет полета и
 * нито едно повече: всяко допълнително поле на регистрацията изяжда процент
 * от хората, които стигат до края ѝ.
 *
 * ═══ ЗАЩО ВЪЗРАСТТА СЕ ПРЕВРЪЩА В ГОДИНА ═══
 *
 * Формата пита „на колко си години", защото така мисли човекът. В базата
 * влиза ГОДИНАТА на раждане. Записана веднъж, възрастта остава невярна
 * завинаги; годината е вярна винаги.
 *
 * ═══ ЗАЩО ПУБЛИЧНИЯТ ГАРДЕРОБ Е ИЗКЛЮЧЕН ПО ПОДРАЗБИРАНЕ ═══
 *
 * Публикуването на снимка с лице е решение с последствия, които не се
 * връщат назад. Такова решение се взима нарочно, а не се получава, защото
 * някой е бързал през регистрацията. Затова полето тръгва изключено и се
 * включва само с изричен избор.
 *
 * Под 18 години публичен гардероб не се позволява изобщо — независимо какво
 * е избрано на екрана. Проверката е тук, на сървъра, а не в интерфейса.
 */

import { dbSystem, type Gender } from '@probvai/db';

/** Под тази възраст не пускаме регистрация. */
export const MIN_AGE = 16;

/** Под тази възраст гардеробът не може да бъде публичен. */
export const PUBLIC_WARDROBE_MIN_AGE = 18;

export const MAX_AGE = 100;

const NAME_MAX = 60;

export const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const satisfies readonly Gender[];

export function isGender(value: unknown): value is Gender {
  return typeof value === 'string' && (GENDERS as readonly string[]).includes(value);
}

export type ProfileInput = {
  firstName: unknown;
  lastName: unknown;
  gender: unknown;
  age: unknown;
  wardrobePublic: unknown;
};

export type ProfileFailure =
  | 'BAD_FIRST_NAME'
  | 'BAD_LAST_NAME'
  | 'BAD_GENDER'
  | 'BAD_AGE'
  | 'TOO_YOUNG'
  | 'USER_NOT_FOUND';

export type ProfileResult =
  | {
      ok: true;
      /** Вярно, ако сме изключили публичния гардероб заради възрастта. */
      publicRefused: boolean;
    }
  | { ok: false; reason: ProfileFailure };

function cleanName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  // Няколко интервала едно след друго стават един. „  Иван  " е „Иван".
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length < 2 || trimmed.length > NAME_MAX) return null;
  return trimmed;
}

/**
 * Записва профила и отбелязва регистрацията за завършена.
 *
 * Пише през системната роля, защото `profile_completed_at` е състояние на
 * акаунта, а не поле, което човек си променя всеки ден.
 */
export async function completeProfile(
  userId: string,
  input: ProfileInput,
): Promise<ProfileResult> {
  const firstName = cleanName(input.firstName);
  if (!firstName) return { ok: false, reason: 'BAD_FIRST_NAME' };

  const lastName = cleanName(input.lastName);
  if (!lastName) return { ok: false, reason: 'BAD_LAST_NAME' };

  if (!isGender(input.gender)) return { ok: false, reason: 'BAD_GENDER' };

  const age = Number(input.age);
  if (!Number.isInteger(age) || age < 1 || age > MAX_AGE) {
    return { ok: false, reason: 'BAD_AGE' };
  }
  if (age < MIN_AGE) return { ok: false, reason: 'TOO_YOUNG' };

  const wantsPublic = input.wardrobePublic === true;
  const allowedPublic = wantsPublic && age >= PUBLIC_WARDROBE_MIN_AGE;

  const birthYear = new Date().getFullYear() - age;

  try {
    await dbSystem().user.update({
      where: { id: userId },
      data: {
        firstName,
        lastName,
        gender: input.gender,
        birthYear,
        wardrobePublic: allowedPublic,
        profileCompletedAt: new Date(),
        // Auth.js показва `name` на много места. Държим го в крак, за да не
        // се разминават двете имена в интерфейса.
        name: `${firstName} ${lastName}`,
      },
    });
  } catch {
    return { ok: false, reason: 'USER_NOT_FOUND' };
  }

  return { ok: true, publicRefused: wantsPublic && !allowedPublic };
}

/** Възрастта днес, от годината на раждане. */
export function ageFromBirthYear(birthYear: number | null | undefined): number | null {
  if (!birthYear) return null;
  return new Date().getFullYear() - birthYear;
}

/** Може ли този човек да публикува в Lookbook. */
export function mayPublish(user: {
  wardrobePublic: boolean;
  birthYear: number | null;
}): boolean {
  const age = ageFromBirthYear(user.birthYear);
  return user.wardrobePublic && age !== null && age >= PUBLIC_WARDROBE_MIN_AGE;
}
