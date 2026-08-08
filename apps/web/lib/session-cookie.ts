/**
 * СЕСИЯ ПРИ ВХОД С ПАРОЛА
 *
 * ═══ ЗАЩО НЕ Е ПРЕЗ CREDENTIALS ДОСТАВЧИКА НА AUTH.JS ═══
 *
 * Auth.js работи с Credentials САМО при сесии в JWT. А това приложение
 * държи сесиите В БАЗАТА нарочно: сесия в базата се прекратява веднага —
 * при спиране на акаунт, при изтриване на профил, при смяна на парола.
 * JWT е валиден, докато не изтече, и никой не може да го отмени.
 *
 * Изборът беше: да изгубим отмяната на сесии заради удобството на едно
 * готово парче, или да напишем двайсет реда. Двайсетте реда са тук.
 *
 * ═══ КАК РАБОТИ ═══
 *
 * Auth.js не пази нищо в самата бисквитка — тя носи само случаен низ,
 * който се търси в таблицата `sessions`. Значи е достатъчно да напишем реда
 * и да сложим същия низ в бисквитката със същото име. Оттам нататък
 * `auth()` намира сесията, все едно я е създал сам.
 *
 * Името на бисквитката е това на Auth.js, включително префикса `__Secure-`
 * при https. Сгрешим ли го, влизането „минава" и после нищо не е влязло.
 */

import { cookies } from 'next/headers';
import { dbSystem } from '@probvai/db';

/** Колкото и в auth.ts: 30 дни. */
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * Пред https бисквитките носят префикс `__Secure-`. Той не е украса —
 * браузърът отказва такава бисквитка, ако дойде по нешифрована връзка.
 */
function secure(): boolean {
  const url = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? '';
  return url.startsWith('https://');
}

function cookieName(): string {
  return `${secure() ? '__Secure-' : ''}authjs.session-token`;
}

/**
 * Създава сесия в базата и я закача за браузъра.
 *
 * Токенът е 32 случайни байта от `crypto` — не от `Math.random`, който е
 * предсказуем и не бива да се доближава до нищо, свързано с вход.
 */
export async function createSession(userId: string): Promise<void> {
  const token = crypto.randomUUID() + crypto.randomUUID().replaceAll('-', '');
  const expires = new Date(Date.now() + MAX_AGE_SECONDS * 1000);

  await dbSystem().session.create({
    data: { sessionToken: token, userId, expires },
  });

  // Нулира брояча за 90-те дни неактивност, както прави и входът с Google.
  await dbSystem()
    .user.update({ where: { id: userId }, data: { lastActiveAt: new Date(), deletionWarnedAt: null } })
    .catch(() => undefined);

  const store = await cookies();
  store.set(cookieName(), token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: secure(),
    maxAge: MAX_AGE_SECONDS,
  });
}

/**
 * Излизане.
 *
 * Редът в базата се трие ПЪРВИ. Ако процесът умре между двете стъпки,
 * най-лошото е бисквитка, която вече не отваря нищо — а не сесия, която
 * живее, след като човекът е натиснал „Излез".
 */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(cookieName())?.value;

  if (token) {
    await dbSystem()
      .session.deleteMany({ where: { sessionToken: token } })
      .catch(() => undefined);
  }

  store.delete(cookieName());
}
