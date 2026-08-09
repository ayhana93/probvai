import { SECURITY_QUESTIONS } from '@probvai/core';

export const runtime = 'nodejs';

/**
 * GET /api/nalog/vaprosi — списъкът с тайни въпроси.
 *
 * Идва от сървъра, а не е преписан в интерфейса, защото ключовете трябва да
 * съвпадат с тези, които приемаме при регистрация. Второ копие в клиента се
 * разминава при първата добавена възможност — и тогава регистрацията отказва
 * въпрос, който сама е показала.
 *
 * Списъкът е публичен по своята природа: всеки, стигнал до регистрацията,
 * го вижда. Затова се кешира.
 */
export function GET(): Response {
  return Response.json(
    { questions: SECURITY_QUESTIONS },
    { headers: { 'cache-control': 'public, max-age=3600' } },
  );
}
