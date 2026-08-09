import { extractGarment, type ExtractFailure } from '@probvai/core';
import { jsonError, readJson, requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUS: Record<ExtractFailure, number> = {
  BAD_URL: 400,
  BLOCKED: 400,
  NO_IMAGE_FOUND: 422,
  IMAGE_UNUSABLE: 422,
  FETCH_FAILED: 502,
};

/**
 * POST /api/extract-garment — взима снимката на дрехата от линк.
 *
 * Всяко обръщение навън минава през защитата от SSRF в
 * `packages/core/src/net-guard.ts`: частните диапазони са забранени,
 * пренасочванията се проверяват стъпка по стъпка, има таймаут и таван
 * на размера.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await requireUser();
  if (session.response) return session.response;

  const body = await readJson<{ url?: unknown }>(request);
  if (!body || typeof body.url !== 'string' || body.url.trim().length === 0) {
    return jsonError(400, 'BAD_REQUEST', 'Постави линк към дрехата.');
  }

  const result = await extractGarment(session.user.id, body.url);

  if (!result.ok) {
    return jsonError(STATUS[result.reason], result.reason, result.message);
  }

  return Response.json({
    garmentKey: result.garmentKey,
    // Заданието иска `imageUrl` — това е нашият адрес към вече свалената
    // снимка, а не чужд адрес към магазина.
    imageUrl: `/api/images/${result.garmentKey}`,
    title: result.title,
    merchant: result.merchant,
    affiliateUrl: result.affiliateUrl,
  });
}
