import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { BottomNav } from '@/components/bottom-nav';
import { ProfileGate } from '@/components/profile-gate';
import { R } from '@/lib/routes';

/**
 * Обвивката на потребителското приложение.
 *
 * ═══ ТУК Е ПРЕГРАДАТА ═══
 *
 * Дотук приложението се отваряше без вход. Всеки екран се виждаше; API-тата
 * отказваха, но човек стигаше до тях и виждаше празни екрани и скелети —
 * тоест приложението изглеждаше счупено, вместо заключено.
 *
 * Проверката е СЪРВЪРНА и е в layout-а, значи важи за всеки екран под него
 * наведнъж. Нов екран в тази папка е защитен, без някой да се е сетил да го
 * защити — а забравената защита е точно това, което се пропуска.
 *
 * ═══ ЗАЩО НЕ Е MIDDLEWARE ═══
 *
 * Middleware-ът на Next върви на Edge, а там Prisma не работи. Стандартният
 * заобиколен път е разделена конфигурация на Auth.js — втори файл без
 * адаптер, който трябва да се държи в крак с първия. Два източника на
 * истината за това кой е влязъл е точно нещото, което рано или късно се
 * разминава.
 *
 * Тази проверка чете сесията от базата, на Node, наведнъж. По-бавна е с
 * една заявка и е вярна.
 */
export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect(R.start);
  }

  return (
    <div
      className={
        'mx-auto min-h-dvh w-full max-w-[430px] pb-[124px] ' +
        // Горният отстъп е за пробива на екрана. В браузър е нула и нищо
        // не се променя; сложено ли е приложението на началния екран,
        // `viewportFit: cover` пуска съдържанието под лентата на часа —
        // и първото нещо на всеки екран влиза под нея.
        'pt-[env(safe-area-inset-top)]'
      }
    >
      <ProfileGate />
      {children}
      <BottomNav />
    </div>
  );
}
