'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutGrid,
  Dumbbell,
  Utensils,
  User,
  Plus,
} from 'lucide-react';
import { hapticImpact } from '@/lib/telegram/webapp';

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const isTabActive = (href: string): boolean => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const handleCenterPlusClick = () => {
    hapticImpact('heavy');
    if (pathname !== '/workouts') {
      router.push('/workouts');
    } else {
      // Скроллим к форме или добавляем упражнение
      window.dispatchEvent(new CustomEvent('workout-add-exercise'));
    }
  };

  const handleProfileClick = () => {
    hapticImpact('light');
    window.dispatchEvent(new CustomEvent('open-body-profile-modal'));
  };

  return (
    <nav
      aria-label="Нижняя панель вкладок"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-[#0B0B0E]/95 pb-safe backdrop-blur-2xl shadow-2xl shadow-black/90"
    >
      <div className="mx-auto flex h-[62px] max-w-md items-center justify-between px-3">
        {/* 1. ГЛАВНАЯ */}
        <Link
          href="/"
          onClick={() => hapticImpact('light')}
          className={`group relative flex flex-1 flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
            isTabActive('/') ? 'text-[#C4F124]' : 'text-[#8F90A6]/60 hover:text-white'
          }`}
        >
          {isTabActive('/') && (
            <span className="absolute top-0 h-0.5 w-8 rounded-full bg-[#C4F124] shadow-[0_0_12px_#C4F124]" />
          )}
          <LayoutGrid
            className={`h-5 w-5 transition-transform ${isTabActive('/') ? 'scale-110 drop-shadow-[0_2px_8px_rgba(196,241,36,0.5)]' : ''}`}
            strokeWidth={isTabActive('/') ? 2.5 : 1.8}
          />
          <span className={`text-[10px] font-black uppercase tracking-wider ${isTabActive('/') ? 'text-[#C4F124]' : 'text-[#8F90A6]'}`}>
            Home
          </span>
        </Link>

        {/* 2. ТРЕНИРОВКИ */}
        <Link
          href="/workouts"
          onClick={() => hapticImpact('light')}
          className={`group relative flex flex-1 flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
            isTabActive('/workouts') ? 'text-[#C4F124]' : 'text-[#8F90A6]/60 hover:text-white'
          }`}
        >
          {isTabActive('/workouts') && (
            <span className="absolute top-0 h-0.5 w-8 rounded-full bg-[#C4F124] shadow-[0_0_12px_#C4F124]" />
          )}
          <Dumbbell
            className={`h-5 w-5 transition-transform ${isTabActive('/workouts') ? 'scale-110 drop-shadow-[0_2px_8px_rgba(196,241,36,0.5)]' : ''}`}
            strokeWidth={isTabActive('/workouts') ? 2.5 : 1.8}
          />
          <span className={`text-[10px] font-black uppercase tracking-wider ${isTabActive('/workouts') ? 'text-[#C4F124]' : 'text-[#8F90A6]'}`}>
            Workouts
          </span>
        </Link>

        {/* 3. ЦЕНТРАЛЬНАЯ КНОПКА «+» (КАК НА МАКЕТЕ PINTEREST) */}
        <div className="flex flex-1 items-center justify-center -translate-y-2">
          <button
            type="button"
            onClick={handleCenterPlusClick}
            aria-label="Быстрое добавление"
            className="group flex h-12 w-12 items-center justify-center rounded-2xl bg-[#C4F124] text-black shadow-xl shadow-[#C4F124]/30 ring-4 ring-[#0B0B0E] transition-transform duration-200 hover:scale-110 active:scale-90"
          >
            <Plus className="h-6 w-6 stroke-[3] transition-transform group-hover:rotate-90" />
          </button>
        </div>

        {/* 4. ПИТАНИЕ */}
        <Link
          href="/nutrition"
          onClick={() => hapticImpact('light')}
          className={`group relative flex flex-1 flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
            isTabActive('/nutrition') ? 'text-[#C4F124]' : 'text-[#8F90A6]/60 hover:text-white'
          }`}
        >
          {isTabActive('/nutrition') && (
            <span className="absolute top-0 h-0.5 w-8 rounded-full bg-[#C4F124] shadow-[0_0_12px_#C4F124]" />
          )}
          <Utensils
            className={`h-5 w-5 transition-transform ${isTabActive('/nutrition') ? 'scale-110 drop-shadow-[0_2px_8px_rgba(196,241,36,0.5)]' : ''}`}
            strokeWidth={isTabActive('/nutrition') ? 2.5 : 1.8}
          />
          <span className={`text-[10px] font-black uppercase tracking-wider ${isTabActive('/nutrition') ? 'text-[#C4F124]' : 'text-[#8F90A6]'}`}>
            Nutrition
          </span>
        </Link>

        {/* 5. ПРОФИЛЬ / ИМТ */}
        <button
          type="button"
          onClick={handleProfileClick}
          className="group relative flex flex-1 flex-col items-center justify-center gap-1 text-[#8F90A6]/60 transition-all hover:text-white active:scale-95"
        >
          <User className="h-5 w-5 transition-transform group-hover:scale-105" strokeWidth={1.8} />
          <span className="text-[10px] font-black uppercase tracking-wider text-[#8F90A6]">
            Profile
          </span>
        </button>
      </div>
    </nav>
  );
}
