import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      credits: number;
      // Нарочно НЕ се казват `emailVerified` — Auth.js вече ползва това име
      // за поле от тип Date и двете дефиниции се сблъскват.
      hasVerifiedEmail: boolean;
      hasVerifiedPhone: boolean;
    } & DefaultSession['user'];
  }
}
