/**
 * SMS през Twilio.
 *
 * Праща се само при висок риск — SMS-ите струват пари и не искаме да
 * досаждаме на редовите потребители.
 *
 * Както при имейлите: без ключове в режим на разработка съобщението се
 * изписва в конзолата, за да работи потокът локално.
 */

import twilio from 'twilio';
import { env } from './env';

export type SmsResult = { ok: true; sid?: string } | { ok: false; error: string };

type TwilioClient = ReturnType<typeof twilio>;

let client: TwilioClient | undefined;

function twilioClient(): TwilioClient | null {
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  const from = env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) return null;

  client ??= twilio(sid, token);
  return client;
}

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const api = twilioClient();

  if (!api) {
    if (env.NODE_ENV === 'production') {
      return { ok: false, error: 'Липсват настройките за Twilio' };
    }
    console.info(
      [
        '',
        '┌─ SMS (не е пратен, липсват Twilio настройки) ────────────',
        `│ До: ${to}`,
        `│ ${body}`,
        '└──────────────────────────────────────────────────────────',
        '',
      ].join('\n'),
    );
    return { ok: true };
  }

  try {
    const message = await api.messages.create({
      to,
      from: env.TWILIO_PHONE_NUMBER,
      body,
    });
    return { ok: true, sid: message.sid };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
