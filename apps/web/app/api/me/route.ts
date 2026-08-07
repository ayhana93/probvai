import { dbAsUser } from '@probvai/db';
import { requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/me — профилът на влезлия потребител.
 *
 * Чете през `dbAsUser`, а не през системната връзка. Разликата е, че тук
 * базата, а не кодът, гарантира че се връщат само нейните редове.
 */
export async function GET(): Promise<Response> {
  const session = await requireUser();
  if (session.response) return session.response;

  const db = dbAsUser(session.user.id);

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      credits: true,
      emailVerified: true,
      phoneVerifiedAt: true,
      defaultPhotoKey: true,
      createdAt: true,
    },
  });

  if (!me) {
    return Response.json({ error: { code: 'NOT_FOUND', message: 'Профилът липсва.' } }, { status: 404 });
  }

  const recentLedger = await db.creditLedger.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { delta: true, reason: true, balance: true, createdAt: true },
  });

  return Response.json(
    {
      id: me.id,
      email: me.email,
      name: me.name,
      credits: me.credits,
      emailVerified: Boolean(me.emailVerified),
      phoneVerified: Boolean(me.phoneVerifiedAt),
      hasDefaultPhoto: Boolean(me.defaultPhotoKey),
      memberSince: me.createdAt.toISOString(),
      ledger: recentLedger,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
