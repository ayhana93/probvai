import { handleStripeEvent, verifyWebhook } from '@probvai/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/stripe
 *
 * ЕДИНСТВЕНОТО място в системата, където покупка се превръща в кредити.
 *
 * ═══ ЗАЩО ТУК, А НЕ ПРИ ВРЪЩАНЕТО ОТ STRIPE ═══
 *
 * Екранът „успех" е обикновено пренасочване в браузъра. Всеки може да го
 * отвори на ръка и да напише какъвто иска адрес. Ако кредитите се
 * начисляваха там, приложението щеше да раздава кредити безплатно на всеки,
 * който познае адреса.
 *
 * Това тяло идва подписано с таен ключ, който има само Stripe. Подписът се
 * проверява върху СУРОВИЯ текст — затова `request.text()`, не `request.json()`.
 *
 * ═══ ЗАЩО ОТГОВАРЯМЕ 200 НА ПОЧТИ ВСИЧКО ═══
 *
 * Всеки отговор, различен от 2xx, кара Stripe да повтаря събитието с часове
 * и накрая да изключи endpoint-а. Изключен endpoint значи платени, но
 * незаредени кредити. Затова 4xx връщаме само при невалиден подпис —
 * единственият случай, в който подателят не е Stripe.
 */
export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();
  const signature = request.headers.get('stripe-signature');

  const event = verifyWebhook(raw, signature);
  if (!event) {
    return Response.json({ error: 'невалиден подпис' }, { status: 400 });
  }

  try {
    const outcome = await handleStripeEvent(event);
    return Response.json({ received: true, outcome });
  } catch (error) {
    // Базата е паднала или нещо друго временно се е счупило. Тук 500 е
    // правилният отговор: искаме Stripe да повтори.
    console.error(`[плащания] събитие ${event.id} (${event.type}) се провали:`, error);
    return Response.json({ error: 'временен проблем' }, { status: 500 });
  }
}
