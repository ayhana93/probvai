/**
 * Помощници за route handler-ите.
 *
 * `requireUser` е първата стъпка на всеки защитен endpoint. Връща или
 * потребителя, или готов отговор 401 — така в самия handler няма как да се
 * забрави проверката: типът не позволява да продължиш без потребител.
 */

import { auth } from '@/auth';

export type SessionUser = {
  id: string;
  email: string;
  credits: number;
  emailVerified: boolean;
  phoneVerified: boolean;
};

type Authorized = { user: SessionUser; response?: never };
type Unauthorized = { user?: never; response: Response };

export async function requireUser(): Promise<Authorized | Unauthorized> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      response: jsonError(401, 'UNAUTHORIZED', 'Трябва да влезеш в профила си.'),
    };
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email ?? '',
      credits: session.user.credits,
      emailVerified: session.user.hasVerifiedEmail,
      phoneVerified: session.user.hasVerifiedPhone,
    },
  };
}

/**
 * Единен вид на грешките: код за кода и съобщение за човека.
 * Съобщението се показва както е, затова е на български и казва какво
 * да направи потребителя, а не какво се е счупило.
 */
export function jsonError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

/** Чете JSON тялото, без да хвърля при неправилен вход. */
export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
