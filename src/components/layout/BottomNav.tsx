'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  Dumbbell,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import { hapticImpact } from '@/lib/telegram/webapp';

interface IosTabItem {
  href: string;
  shortLabel: string;
  fullLabel: string;
  icon: LucideIcon;
}

const IOS_TABS: IosTabItem[] = [
  {
    href: '/',
    shortLabel: 'Главная',
    fullLabel: 'Главная / Сводка',
    icon: LayoutGrid,
  },
  {
    href: '/workouts',
    shortLabel: 'Тренировки',
    fullLabel: 'Тренировки & Сеты',
    icon: Dumbbell,
  },
  {
    href: '/nutrition',
    shortLabel: 'Питание',
    fullLabel: 'Питание & КБЖУ',
    icon: Utensils,
  },
];

export function BottomNav() {
  const pathname = usePathname();

  const isTabActive = (href: string): boolean => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav
      aria-label="Нижняя панель вкладок"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-[#0B0B0E]/90 pb-safe backdrop-blur-2xl shadow-2xl shadow-black/90"
    >
      <ul className="mx-auto grid h-[60px] max-w-md grid-cols-3 items-center px-4">
        {IOS_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = isTabActive(tab.href);

          return (
            <li key={tab.href} className="h-full">
              <Link
                href={tab.href}
                onClick={() => hapticImpact('light')}
                aria-label={tab.fullLabel}
                aria-current={active ? 'page' : undefined}
                className={`group relative flex h-full flex-col items-center justify-center gap-1 transition-all duration-150 active:scale-95 ${
                  active
                    ? 'text-[#C4F124]'
                    : 'text-[#8F90A6]/60 hover:text-white'
                }`}
              >
                {/* Неоново-лаймовый индикатор активной вкладки */}
                {active && (
                  <span className="absolute top-0 h-0.5 w-10 rounded-full bg-[#C4F124] shadow-[0_0_12px_#C4F124]" />
                )}

                <div className="relative">
                  <Icon
                    className={`h-[22px] w-[22px] shrink-0 transition-transform duration-200 ${
                      active ? 'scale-110 drop-shadow-[0_2px_10px_rgba(196,241,36,0.5)] text-[#C4F124]' : 'group-hover:scale-105'
                    }`}
                    strokeWidth={active ? 2.5 : 1.8}
                  />
                </div>

                <span
                  className={`font-sans text-[11px] font-black uppercase tracking-wider transition-colors duration-150 ${
                    active ? 'text-[#C4F124]' : 'text-[#8F90A6]/70'
                  }`}
                >
                  {tab.shortLabel}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
