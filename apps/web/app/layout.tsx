import type { Metadata, Viewport } from 'next';
import { Inter, Unbounded } from 'next/font/google';
import './globals.css';
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site';

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
  /**
   * ═══ БЕЗ ТОВА КАРТИНКАТА ПРИ СПОДЕЛЯНЕ НЕ РАБОТИ ═══
   *
   * Next слага `opengraph-image.png` сам, но адресът излиза ОТНОСИТЕЛЕН, а
   * всяка социална мрежа дърпа картинката от свой сървър — относителният
   * адрес там не значи нищо. `metadataBase` е това, което го прави пълен.
   *
   * Пропуснат, Next тихо ползва `localhost:3000` и линкът се показва без
   * картинка, без нищо да се оплаче.
   */
  metadataBase: new URL(SITE_URL),

  title: SITE_NAME,
  description: SITE_TAGLINE,

  /**
   * ═══ КАКВО СЕ ВИЖДА, КОГАТО ЛИНКЪТ СЕ ПУСНЕ НЯКЪДЕ ═══
   *
   * Картинката е `app/opengraph-image.png` — Next я закача по име, тук не
   * се изброява. Прави се от `npm run images`: логото върху хартиен фон,
   * 1200 × 630. Защо не самото `logo.png` — виж коментара в скрипта.
   *
   * `type: 'website'` е нарочно, не `article`: Facebook показва различна
   * карта за двете, а тук няма автор и дата.
   */
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_TAGLINE,
    url: SITE_URL,
    locale: 'bg_BG',
  },

  /**
   * `summary_large_image` е разликата между картинка колкото пощенска марка
   * вляво от текста и голяма карта над него. Без него X показва първото.
   */
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_TAGLINE,
  },

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
};

/**
 * ═══ ТУК НЯМА `maximumScale` И `userScalable` — НАРОЧНО ═══
 *
 * Бяха сложени, за да не се увеличава случайно при двойно докосване. Ефектът
 * на телефон беше друг и лош: Safari пази ниво на увеличение ЗА САЙТА (aA в
 * адресната лента). Влезе ли човек с включено такова, страницата се показва
 * уголемена и дясната ѝ част излиза извън екрана — а `user-scalable=no` му
 * отнема единствения начин да я върне обратно с щипване.
 *
 * Тоест забраната не пази от нищо, а заключва човека в счупен изглед.
 * Освен това е и грешка спрямо достъпността: който не вижда добре, трябва
 * да може да увеличи.
 *
 * Мярката за случайното увеличаване не е забрана, а достатъчно големи цели
 * за пръст — те и без това са задължителни.
 */

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
