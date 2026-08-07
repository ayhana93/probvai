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
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#141416',
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
