import { BottomNav } from '@/components/bottom-nav';

/**
 * Обвивката на потребителското приложение.
 *
 * Мобилна ширина 375px като база, ограничена до 430px — на широк екран
 * приложението остава телефон, а не се разтяга в нечетима лента.
 *
 * Долният отстъп прави място на плаващото меню. Без него последният ред от
 * всеки списък се крие под него — дребна грешка, която дразни всеки път.
 */
export default function UserLayout({ children }: { children: React.ReactNode }) {
  // Баланс и състояние идват от сесията, щом Фаза 4 се вържe за нея.
  const credits = 12;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] pb-[124px]">
      {children}
      <BottomNav credits={credits} />
    </div>
  );
}
