import type { Metadata, Viewport } from 'next';
import { Inter, Unbounded } from 'next/font/google';
import './globals.css';

/**
 * Двата шрифта следват логото: буквите там са тежки, събрани и главни,
 * а под тях трябва нещо, което се чете на 13px без да се напрягаш.
 */
const display = Unbounded({
  subsets: ['cyrillic', 'latin'],
  weight: ['700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const text = Inter({
  subsets: ['cyrillic', 'latin'],
  variable: '--font-text',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ПРОБВАЙ',
  description: 'Виж как ти стои дрехата, преди да я поръчаш.',

  /**
   * ═══ КАКВО ТРЯБВА, ЗА ДА ИЗГЛЕЖДА КАТО ПРИЛОЖЕНИЕ НА ТЕЛЕФОНА ═══
   *
   * Иконите Next ги закача сам от `app/icon.png` и `app/apple-icon.png` —
   * тук не се изброяват. Правят се от `npm run images`.
   *
   * `appleWebApp` е това, което липсваше: без `capable: true` iOS отваря
   * пряката връзка в Safari, с адресна лента, и тя не изглежда като
   * приложение. С него се отваря на цял екран, като истинско.
   *
   * `statusBarStyle: 'default'` значи тъмни букви на светъл фон — вярното
   * за хартиения фон на приложението. `black-translucent` пуска
   * съдържанието под часа; за това вече има отстъп в `(user)/layout.tsx`,
   * но останалите екрани не го чакат.
   */
  applicationName: 'ПРОБВАЙ',
  appleWebApp: {
    capable: true,
    title: 'ПРОБВАЙ',
    statusBarStyle: 'default',
  },

  // Иначе iOS Safari подчертава телефонни номера в текста и ги прави
  // синьи връзки — включително числа, които не са телефони.
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  /**
   * ═══ ЦВЕТЪТ НА ЛЕНТАТА ГОРЕ ═══
   *
   * Беше тъмен, като долното меню. На телефон обаче тази стойност боядисва
   * лентата НАД съдържанието, а съдържанието е хартиено — получаваше се
   * черна ивица над светъл екран, която изглежда като чужда част.
   *
   * Сега е хартиеният цвят: лентата се слива с екрана и приложението
   * започва от самия ръб.
   */
  themeColor: '#faf6ef',
  // Приложението се държи като приложение: без щипване за увеличение, което
  // на телефон значи случайно увеличаване при двойно докосване.
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bg" className={`${display.variable} ${text.variable}`}>
      <body
        className="min-h-dvh antialiased"
        style={{ fontFamily: 'var(--font-text), system-ui, sans-serif' }}
      >
        {children}
      </body>
    </html>
  );
}
