'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  Dumbbell,
  BookOpen,
  Utensils,
  Terminal,
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
    shortLabel: 'Сводка',
    fullLabel: 'Главная / Сводка',
    icon: LayoutGrid,
  },
  {
    href: '/workouts',
    shortLabel: 'Тренировки',
    fullLabel: 'Тренировки',
    icon: Dumbbell,
  },
  {
    href: '/reading',
    shortLabel: 'Книги',
    fullLabel: 'Книги и Коран',
    icon: BookOpen,
  },
  {
    href: '/nutrition',
    shortLabel: 'Питание',
    fullLabel: 'Питание',
    icon: Utensils,
  },
  {
    href: '/vibecoding',
    shortLabel: 'Кодинг',
    fullLabel: 'Вайбкодинг',
    icon: Terminal,
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-[#1A1615]/85 pb-safe backdrop-blur-2xl shadow-2xl shadow-black/80"
    >
      <ul className="mx-auto grid h-[56px] max-w-lg grid-cols-5 items-center px-1">
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
                    ? 'text-[#F5BA42]'
                    : 'text-[#A8A199]/60 hover:text-[#FAF7F5]'
                }`}
              >
                {/* Золотой микро-индикатор активной вкладки сверху */}
                {active && (
                  <span className="absolute top-0 h-0.5 w-7 rounded-full bg-[#F5BA42] shadow-[0_0_8px_#F5BA42]" />
                )}

                <div className="relative">
                  <Icon
                    className={`h-[21px] w-[21px] shrink-0 transition-transform duration-200 ${
                      active ? 'scale-110 drop-shadow-[0_2px_8px_rgba(245,186,66,0.35)]' : 'group-hover:scale-105'
                    }`}
                    strokeWidth={active ? 2.4 : 1.8}
                  />
                </div>

                <span
                  className={`max-w-full truncate px-0.5 text-[10px] leading-none tracking-tight ${
                    active ? 'font-bold text-[#FAF7F5]' : 'font-medium'
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
