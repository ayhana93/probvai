import { dbAsUser } from '@probvai/db';
import { requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/me/danni — всичките данни на човека, в един файл.
 *
 * Правото на преносимост по GDPR. Политиката за поверителност обещава, че
 * копието се сваля само, без да се пита никого — това е мястото, където
 * обещанието се изпълнява.
 *
 * ═══ КАКВО НЕ ВЛИЗА ═══
 *
 * Хешът на паролата и хешът на тайния отговор. Те не са „негови данни" в
 * смисъла на преносимост — те са ключове към акаунта. Файл, който човек
 * праща по имейл на поддръжката, не бива да ги носи.
 *
 * Не влизат и самите снимки. Файл от сто мегабайта не се сваля на телефон
 * по мобилна мрежа; вместо тях влизат адресите, от които се теглят.
 */
export async function GET(): Promise<Response> {
  const session = await requireUser();
  if (session.response) return session.response;

  const db = dbAsUser(session.user.id);

  const [me, generations, ledger] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true, email: true, firstName: true, lastName: true, phone: true,
        gender: true, birthYear: true, credits: true, xp: true,
        lifetimeSpendCents: true, wardrobePublic: true, createdAt: true,
      },
    }),
    db.generation.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, status: true, source: true, merchant: true, category: true,
        watermarked: true, publishedAt: true, createdAt: true,
      },
    }),
    db.creditLedger.findMany({
      orderBy: { createdAt: 'desc' },
      select: { delta: true, reason: true, balance: true, createdAt: true },
    }),
  ]);

  const payload = {
    izneseno_na: new Date().toISOString(),
    profil: me,
    probi: generations,
    krediti: ledger,
    zabelejka:
      'Снимките не са в този файл заради размера. Свалят се от гардероба.',
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="probvai-danni.json"`,
      'cache-control': 'no-store',
    },
  });
}
