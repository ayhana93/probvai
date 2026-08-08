import { ageFromBirthYear, tierFrom } from '@probvai/core';
import { dbAsUser } from '@probvai/db';
import { requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/me — профилът на влезлия потребител.
 *
 * Чете през `dbAsUser`, а не през системната връзка. Разликата е, че тук
 * базата, а не кодът, гарантира че се връщат само неговите редове.
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
      firstName: true,
      lastName: true,
      gender: true,
      phone: true,
      birthYear: true,
      wardrobePublic: true,
      profileCompletedAt: true,
      xp: true,
      lifetimeSpendCents: true,
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

  const tier = tierFrom(me.xp, me.lifetimeSpendCents);

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

      profile: {
        firstName: me.firstName,
        lastName: me.lastName,
        gender: me.gender,
        phone: me.phone,
        age: ageFromBirthYear(me.birthYear),
        wardrobePublic: me.wardrobePublic,
        // Докато е `false`, интерфейсът показва екрана за довършване.
        completed: me.profileCompletedAt !== null,
      },

      tier: {
        xp: tier.xp,
        rank: tier.rank.title,
        rankNote: tier.rank.note,
        emoji: tier.rank.emoji,
        next: tier.next?.title ?? null,
        toNext: tier.toNext,
        progressPct: tier.progressPct,
        vip: tier.vip,
        spentEur: tier.spentEur,
        toVipEur: tier.toVipEur,
      },
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
