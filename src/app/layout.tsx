import type { Metadata, Viewport } from 'next';
import './globals.css';

// Настройка области просмотра: viewport-fit=cover обязателен для работы env(safe-area-inset-*) под Dynamic Island
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
};

// Метатеги для нативного запуска PWA с экрана «Домой» на iPhone (Standalone режим)
export const metadata: Metadata = {
  title: 'Умный ежедневник саморазвития',
  description:
    'Персональный PWA-ежедневник для iPhone: тренировки, книги и Коран, питание (КБЖУ) и вайбкодинг',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Ежедневник',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      {
        url: '/icons/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
  // Явно дублируем apple-mobile-web-app-capable для 100% совместимости со всеми версиями iOS Safari
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="min-h-dvh bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
