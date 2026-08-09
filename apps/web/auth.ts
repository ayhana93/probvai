/**
 * АВТЕНТИКАЦИЯ — Auth.js v5.
 *
 * Сесиите живеят в базата, не в JWT. Разликата има значение: сесия в базата
 * може да бъде прекратена веднага — при спиране на акаунт, при изтриване на
 * профил, при подозрителна активност. JWT е валиден, докато не изтече, и
 * никой не може да го отмени.
 *
 * Адаптерът работи през ролята `app_system`, защото създава потребители и
 * сесии в момент, в който още няма кой да е „текущият потребител" за RLS.
 */

import NextAuth, { type NextAuthConfig } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Apple from 'next-auth/providers/apple';
import Facebook from 'next-auth/providers/facebook';
import Google from 'next-auth/providers/google';
import Resend from 'next-auth/providers/resend';
import { dbSystem, type PrismaClient } from '@probvai/db';
import { reconcileFreeCredits, sendEmail } from '@probvai/core';
import { magicLinkEmail } from '@/lib/emails';

/**
 * ═══ ЗАЩО ТУК ИМА PROXY, А НЕ ПРОСТО `dbSystem()` ═══
 *
 * `const system = dbSystem()` изглежда безобидно, но отваря връзка към базата
 * в мига, в който модулът се ЗАРЕЖДА. А този модул се зарежда от всеки
 * защитен route, значи и при `next build`: стъпката „Collecting page data"
 * внася всеки route файл, за да прочете настройките му.
 *
 * Резултатът беше билд, който иска DATABASE_URL_SYSTEM. Това е грешно по
 * принцип: билдът произвежда артефакт, който върви на много среди, и не бива
 * да знае паролата на нито една от тях. Тайните са на средата, не на кода.
 *
 * Proxy-то отлага извикването до първото истинско докосване на клиента —
 * тоест до първата заявка. При билд никой не го докосва и връзка не се иска.
 */
const system = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    return Reflect.get(dbSystem(), property, receiver) as unknown;
  },
  has(_target, property) {
    return Reflect.has(dbSystem(), property);
  },
});

/**
 * Включваме само доставчиците, за които има ключове. Иначе Auth.js пада
 * при зареждане, а на нов проект рядко има и трите наведнъж.
 */
function providers(): NextAuthConfig['providers'] {
  const list: NextAuthConfig['providers'] = [];

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    list.push(
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: true,
      }),
    );
  }

  if (process.env.APPLE_ID && process.env.APPLE_SECRET) {
    list.push(
      Apple({
        clientId: process.env.APPLE_ID,
        clientSecret: process.env.APPLE_SECRET,
        allowDangerousEmailAccountLinking: true,
      }),
    );
  }

  if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
    list.push(
      Facebook({
        clientId: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: true,
      }),
    );
  }

  // Magic link. Писмото минава през нашия слой за имейли, за да е на
  // български и за да се изписва в конзолата, когато няма ключ.
  list.push(
    Resend({
      apiKey: process.env.RESEND_API_KEY ?? 'resend-key-missing',
      from: process.env.RESEND_FROM ?? 'ПРОБВАЙ <onboarding@resend.dev>',
      async sendVerificationRequest({ identifier, url }) {
        const message = magicLinkEmail(url);
        const result = await sendEmail({
          to: identifier,
          subject: message.subject,
          html: message.html,
          text: message.text,
        });
        if (!result.ok) {
          throw new Error(`Писмото за вход не тръгна: ${result.error}`);
        }
      },
    }),
  );

  return list;
}

/** Доставчиците, при които потвърденият имейл идва от самия доставчик. */
const EMAIL_TRUSTED_PROVIDERS = new Set(['google', 'apple']);

export const config: NextAuthConfig = {
  adapter: PrismaAdapter(system),

  // Приложението стои зад собствен домейн, а не зад Vercel.
  trustHost: true,

  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,

  session: {
    strategy: 'database',
    maxAge: 30 * 24 * 60 * 60, // 30 дни
    updateAge: 24 * 60 * 60,
  },

  pages: {
    signIn: '/vhod',
    verifyRequest: '/vhod/proveri-poshtata',
    error: '/vhod/greshka',
  },

  providers: providers(),

  callbacks: {
    /**
     * Слага в сесията това, от което интерфейсът има нужда на всеки екран:
     * кой е потребителят и колко кредита има.
     */
    async session({ session, user }) {
      const fresh = await system.user.findUnique({
        where: { id: user.id },
        select: {
          credits: true,
          emailVerified: true,
          phoneVerifiedAt: true,
          status: true,
        },
      });

      session.user.id = user.id;
      session.user.credits = fresh?.credits ?? 0;
      session.user.hasVerifiedEmail = Boolean(fresh?.emailVerified);
      session.user.hasVerifiedPhone = Boolean(fresh?.phoneVerifiedAt);

      return session;
    },

    /** Спрян акаунт не влиза. */
    async signIn({ user }) {
      if (!user.id) return true;
      const existing = await system.user.findUnique({
        where: { id: user.id },
        select: { status: true },
      });
      return existing?.status !== 'SUSPENDED';
    },
  },

  events: {
    /**
     * Нов потребител. Тук се раздават безплатните кредити — но само ако
     * рисковата оценка го позволява. Логиката е в `reconcileFreeCredits`.
     */
    async createUser({ user }) {
      if (!user.id) return;
      await reconcileFreeCredits(user.id);
    },

    /**
     * Всяко влизане нулира брояча за 90-те дни неактивност (Фаза 8) и
     * досверява безплатните кредити, ако междувременно нещо се е променило.
     */
    async signIn({ user, account, profile }) {
      if (!user.id) return;

      const current = await system.user.findUnique({
        where: { id: user.id },
        select: { emailVerified: true },
      });

      // Google и Apple сами казват дали имейлът е потвърден. На Facebook
      // не вярваме за това — той не дава такова твърдение надеждно.
      const providerConfirmsEmail =
        account?.provider !== undefined &&
        EMAIL_TRUSTED_PROVIDERS.has(account.provider) &&
        profile?.email_verified === true;

      await system.user.update({
        where: { id: user.id },
        data: {
          lastActiveAt: new Date(),
          deletionWarnedAt: null,
          ...(providerConfirmsEmail && !current?.emailVerified
            ? { emailVerified: new Date() }
            : {}),
        },
      });

      await reconcileFreeCredits(user.id);
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
