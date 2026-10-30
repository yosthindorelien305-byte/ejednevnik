import type { Metadata, Viewport } from 'next';
import './globals.css';

// Настройка области просмотра: viewport-fit=cover обязателен для работы env(safe-area-inset-*) под Dynamic Island
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#141211',
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

import { TelegramInit } from '@/components/layout/TelegramInit';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="bg-[#141211] text-[#FAF7F5]">
      <body className="min-h-dvh bg-[#141211] text-[#FAF7F5] antialiased selection:bg-[#F5BA42]/30 selection:text-[#FAF7F5]">
        <TelegramInit />
        {children}
      </body>
    </html>
  );
}
