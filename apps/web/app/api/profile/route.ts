import {
  completeProfile,
  MIN_AGE,
  PUBLIC_WARDROBE_MIN_AGE,
  type ProfileFailure,
} from '@probvai/core';
import { jsonError, readJson, requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/profile — довършва регистрацията.
 *
 * Име, фамилия, пол, възраст и дали гардеробът да е публичен. Всичко се
 * проверява тук; интерфейсът проверява същото, но само за да е приятно.
 */

const MESSAGES: Record<ProfileFailure, string> = {
  BAD_FIRST_NAME: 'Напиши името си.',
  BAD_LAST_NAME: 'Напиши фамилията си.',
  BAD_GENDER: 'Избери пол.',
  BAD_AGE: 'Напиши възрастта си.',
  TOO_YOUNG: `Приложението е за хора над ${MIN_AGE} години.`,
  USER_NOT_FOUND: 'Профилът липсва. Влез отново.',
};

type Body = {
  firstName?: unknown;
  lastName?: unknown;
  gender?: unknown;
  age?: unknown;
  wardrobePublic?: unknown;
};

export async function POST(request: Request): Promise<Response> {
  const session = await requireUser();
  if (session.response) return session.response;

  const body = await readJson<Body>(request);
  if (!body) {
    return jsonError(400, 'BAD_REQUEST', 'Заявката не е правилно оформена.');
  }

  const result = await completeProfile(session.user.id, {
    firstName: body.firstName,
    lastName: body.lastName,
    gender: body.gender,
    age: body.age,
    wardrobePublic: body.wardrobePublic,
  });

  if (!result.ok) {
    const status = result.reason === 'USER_NOT_FOUND' ? 401 : 400;
    return jsonError(status, result.reason, MESSAGES[result.reason]);
  }

  return Response.json({
    ok: true,
    // Казваме го, вместо да го премълчим. Тихо отменен избор е по-лош от
    // отказан избор с причина.
    ...(result.publicRefused
      ? {
          notice: `Публичен гардероб може след ${PUBLIC_WARDROBE_MIN_AGE} години. Твоят остава личен.`,
        }
      : {}),
  });
}
