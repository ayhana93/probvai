import { dbSystem } from '@probvai/db';

/**
 * GET /api/health → { status, db, version }
 *
 * Ползва се от хостинга, за да реши дали контейнерът е жив. Нарочно не
 * минава през валидацията на `.env` — искаме да отговаря дори когато
 * конфигурацията е счупена, защото точно тогава ни трябва отговор.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  let db = false;

  try {
    await dbSystem().$queryRaw`SELECT 1`;
    db = true;
  } catch (error) {
    console.error('[health] базата не отговаря:', error);
  }

  const body = {
    status: db ? 'ok' : 'degraded',
    db,
    version: process.env.APP_VERSION ?? 'dev',
  };

  // 503 при паднала база, за да не насочва хостингът трафик насам.
  return Response.json(body, {
    status: db ? 200 : 503,
    headers: { 'cache-control': 'no-store' },
  });
}
