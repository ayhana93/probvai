import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ПРОБВАЙ',
  description: 'Виж как ти стои дрехата, преди да я поръчаш.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Мобилен първо. Долното меню е плаващо и трябва да седи над безопасната зона.
  viewportFit: 'cover',
  themeColor: '#1c1c1e',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bg">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
