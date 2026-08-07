/**
 * ИМЕЙЛИ през Resend.
 *
 * Без ключ в режим на разработка писмото се изписва в конзолата вместо да се
 * праща. Така целият поток с magic link работи локално, без домейн и без
 * акаунт. В production липсващ ключ е грешка — тихо непратен имейл за
 * потвърждаване значи потребител, който не може да влезе.
 */

import { Resend } from 'resend';
import { env } from './env';

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type SendResult = { ok: true; id?: string } | { ok: false; error: string };

let resend: Resend | undefined;

function client(): Resend | null {
  const key = env.RESEND_API_KEY;
  if (!key) return null;
  resend ??= new Resend(key);
  return resend;
}

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const api = client();
  const from = env.RESEND_FROM ?? 'ПРОБВАЙ <onboarding@resend.dev>';

  if (!api) {
    if (env.NODE_ENV === 'production') {
      return { ok: false, error: 'Липсва RESEND_API_KEY' };
    }
    console.info(
      [
        '',
        '┌─ ИМЕЙЛ (не е пратен, липсва RESEND_API_KEY) ─────────────',
        `│ До:   ${message.to}`,
        `│ Тема: ${message.subject}`,
        '│',
        message.text ?? stripTags(message.html),
        '└──────────────────────────────────────────────────────────',
        '',
      ].join('\n'),
    );
    return { ok: true };
  }

  try {
    const response = await api.emails.send({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      ...(message.text ? { text: message.text } : {}),
    });

    if (response.error) {
      return { ok: false, error: response.error.message };
    }
    return { ok: true, id: response.data?.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Известие до админа — достигнат дневен таван, паднал доставчик. */
export async function alertAdmin(subject: string, body: string): Promise<SendResult> {
  const to = env.ADMIN_ALERT_EMAIL;
  if (!to) {
    console.error(`[тревога, няма ADMIN_ALERT_EMAIL] ${subject}\n${body}`);
    return { ok: false, error: 'Липсва ADMIN_ALERT_EMAIL' };
  }
  return sendEmail({
    to,
    subject: `[ПРОБВАЙ] ${subject}`,
    html: `<pre style="font:14px/1.5 ui-monospace,monospace">${escapeHtml(body)}</pre>`,
    text: body,
  });
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
