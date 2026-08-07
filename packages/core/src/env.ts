/**
 * Единственото място, което чете `process.env`.
 *
 * Правило №2 от заданието: нула твърдо зашити стойности. Всяка цена, лимит и
 * праг минава оттук и се проверява при първо ползване.
 *
 * Проверката е ЛЕНИВА нарочно. Ако валидирахме при зареждане на модула,
 * `next build` щеше да пада на машина без пълен `.env` — а по време на билд
 * нито един ключ не е нужен.
 */

import { z } from 'zod';

const schema = z.object({
  // ── Приложение ───────────────────────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  APP_VERSION: z.string().default('dev'),

  // „Днес" за дневния таван значи днес в тази зона, не в UTC.
  APP_TIMEZONE: z.string().default('Europe/Sofia'),

  // Спира ВСИЧКИ генерации. Ползва се при поддръжка и при авария.
  MAINTENANCE_MODE: z
    .enum(['0', '1', 'true', 'false'])
    .default('0')
    .transform((value) => value === '1' || value === 'true'),

  // ── Пари и аварийни спирачки ─────────────────────────────────────────────
  // Без стойност по подразбиране. Приложение без таван на разхода е
  // приложение, което може да ни струва €3000 за една нощ.
  MAX_DAILY_SPEND_USD: z.coerce.number().positive(),
  DAILY_SPEND_ALERT_PCT: z.coerce.number().min(1).max(100).default(80),
  MAX_GENERATIONS_PER_USER_PER_DAY: z.coerce.number().int().positive(),
  GENERATION_COOLDOWN_SECONDS: z.coerce.number().int().nonnegative().default(15),
  GENERATION_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(120),
  GENERATION_CLIENT_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(90),

  // ── Кредити ──────────────────────────────────────────────────────────────
  CREDIT_PRICE_EUR: z.coerce.number().positive(),
  MIN_PURCHASE_CREDITS: z.coerce.number().int().positive().default(25),
  MAX_PURCHASE_CREDITS: z.coerce.number().int().positive().default(1000),
  FREE_CREDITS_SIGNUP: z.coerce.number().int().nonnegative().default(3),
  FREE_CREDITS_EMAIL_VERIFIED: z.coerce.number().int().nonnegative().default(1),
  FREE_CREDITS_PHONE_VERIFIED: z.coerce.number().int().nonnegative().default(1),

  // ── Потвърждаване на телефон ─────────────────────────────────────────────
  PHONE_CODE_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  PHONE_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  PHONE_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
  PHONE_MAX_SENDS_PER_DAY: z.coerce.number().int().positive().default(5),

  // ── Риск ─────────────────────────────────────────────────────────────────
  RISK_THRESHOLD_SMS: z.coerce.number().int().nonnegative().default(40),
  RISK_THRESHOLD_BLOCK: z.coerce.number().int().nonnegative().default(70),

  // ── Запазване на данни ───────────────────────────────────────────────────
  INACTIVITY_DELETE_DAYS: z.coerce.number().int().positive().default(90),
  INACTIVITY_WARN_FIRST_DAYS: z.coerce.number().int().positive().default(76),
  INACTIVITY_WARN_SECOND_DAYS: z.coerce.number().int().positive().default(87),

  // ── Файлове ──────────────────────────────────────────────────────────────
  SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  UPLOAD_MAX_DIMENSION: z.coerce.number().int().positive().default(2048),

  // ── Услуги: празни докато съответната фаза не ги ползва ──────────────────
  // Не са задължителни тук, защото се искат по фази. Всяка от тях се проверява
  // на място с `requireEnv`, за да падне точно там, където липсва.
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_ENDPOINT: z.string().optional(),

  TRYON_PROVIDER: z
    .enum(['fashn_tryon_max', 'fashn_v16', 'fal_image_apps_v2'])
    .default('fashn_tryon_max'),
  FASHN_API_KEY: z.string().optional(),
  FAL_API_KEY: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().optional(),

  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  ADMIN_EMAILS: z.string().optional(),
  ADMIN_ALERT_EMAIL: z.string().optional(),
  SENTRY_DSN: z.string().optional(),

  // ── Извличане на дреха от линк ───────────────────────────────────────────
  EXTRACT_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
  EXTRACT_MAX_BYTES: z.coerce.number().int().positive().default(2 * 1024 * 1024),

  // Партньорски мрежи. `{url}` се заменя с адреса на продукта.
  AFFILIATE_ADMITAD_TEMPLATE: z.string().optional(),
  AFFILIATE_AWIN_TEMPLATE: z.string().optional(),
  AFFILIATE_PROFITSHARE_TEMPLATE: z.string().optional(),

  // ── Воден знак ───────────────────────────────────────────────────────────
  WATERMARK_TEXT: z.string().default('probvai.bg'),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

function load(): Env {
  if (cached) return cached;

  // Правило №3: тайните не влизат в браузъра. Ако този модул някога бъде
  // издърпан в клиентски bundle, искаме шумен провал, а не тих ключ.
  if (typeof globalThis !== 'undefined' && 'window' in globalThis) {
    throw new Error('env: този модул е само за сървъра');
  }

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Грешни или липсващи променливи на средата:\n${problems}\n\n` +
        'Сравни своя .env с .env.example.',
    );
  }

  cached = parsed.data;
  return cached;
}

/**
 * Достъп до настройките: `env.MAX_DAILY_SPEND_USD`.
 * Валидацията се случва при първото четене на каквото и да е поле.
 */
export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    return load()[prop as keyof Env];
  },
  has(_target, prop: string) {
    return prop in load();
  },
  ownKeys() {
    return Reflect.ownKeys(load());
  },
  getOwnPropertyDescriptor(_target, prop: string) {
    return { value: load()[prop as keyof Env], enumerable: true, configurable: true };
  },
});

/**
 * Взима променлива, която е задължителна за конкретна операция.
 * Пада с ясно съобщение точно там, където липсата има значение.
 *
 *   const key = requireEnv('FASHN_API_KEY', 'генерация през FASHN');
 */
export function requireEnv(name: keyof Env, usedFor: string): string {
  const value = env[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Липсва ${String(name)} — нужна е за: ${usedFor}`);
  }
  return value;
}

/** Списъкът с админ имейли, нормализиран. */
export function adminEmails(): string[] {
  return (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/** Само за тестове — кара следващото четене да презареди стойностите. */
export function resetEnvCache(): void {
  cached = undefined;
}
