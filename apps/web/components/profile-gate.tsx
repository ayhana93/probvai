/**
 * ПРЕПРАЩАНЕ КЪМ ДОВЪРШВАНЕ НА ПРОФИЛА
 *
 * Първото влизане дава акаунт, но не и профил: Google не ни казва пол, нито
 * възраст, а фамилията идва слепена с името. Затова, докато профилът не е
 * попълнен, всеки екран води към регистрацията.
 *
 * ═══ ЗАЩО НЕ Е В MIDDLEWARE ═══
 *
 * Middleware-ът върви преди всяка заявка, включително за статичните файлове,
 * и за да разбере дали профилът е попълнен, трябва да пита базата. Това е
 * заявка на всеки натиснат бутон в приложението.
 *
 * Тук проверката е една, на клиента, и резултатът ѝ и без това вече е
 * поискан от `useMe` за баланса.
 *
 * ═══ ЗАЩО НИЩО НЕ СЕ КРИЕ ═══
 *
 * Този компонент не пази данни — само насочва. Всичко истинско е защитено
 * на сървъра, в route handler-ите. Ако някой заобиколи препращането, ще
 * види приложението, но няма да може да направи нищо, което изисква
 * профил — и това е правилното разделение.
 */

'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useMe } from '@/lib/use-me';

const TARGET = '/dovarshi';

export function ProfileGate() {
  const router = useRouter();
  const pathname = usePathname();
  const { me, loading } = useMe();

  React.useEffect(() => {
    if (loading || !me) return;
    if (me.profile.completed) return;
    if (pathname === TARGET) return;

    router.replace(TARGET);
  }, [loading, me, pathname, router]);

  return null;
}
