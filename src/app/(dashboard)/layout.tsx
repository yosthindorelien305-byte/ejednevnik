import React from 'react';
import { BottomNav } from '@/components/layout/BottomNav';
import { AuthHeader } from '@/components/auth/AuthHeader';

/**
 * Оболочка основных экранов ежедневника для iPhone (Standalone PWA):
 * - Липкая верхняя полоса с pt-safe защищает контент от наезда на Dynamic Island / часы при скролле;
 * - pb-tabbar-safe гарантирует, что нижние кнопки форм не перекроются таббаром и полоской жестов iOS.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-dvh bg-[#141211] text-[#FAF7F5] pl-safe pr-safe pb-tabbar-safe">
      {/* Полупрозрачная шапка-подложка под статус-бар iPhone (black-translucent) */}
      <div
        aria-hidden="true"
        className="sticky top-0 z-30 w-full bg-[#141211]/85 pt-safe backdrop-blur-xl"
      />

      <main className="mx-auto w-full max-w-lg px-4 pt-2">
        <AuthHeader />
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
