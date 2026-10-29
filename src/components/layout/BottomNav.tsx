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

interface IosTabItem {
  href: string;
  shortLabel: string;
  fullLabel: string;
  icon: LucideIcon;
}

// 5 разделов нижнего таббара в стиле iOS Safari / Standalone PWA
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
    shortLabel: 'Книги и Коран',
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
    shortLabel: 'Вайбкодинг',
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.08] bg-white/80 pb-safe backdrop-blur-2xl backdrop-saturate-150 dark:border-white/[0.08] dark:bg-zinc-950/80"
    >
      <ul className="mx-auto grid h-[52px] max-w-lg grid-cols-5 items-center px-1">
        {IOS_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = isTabActive(tab.href);

          return (
            <li key={tab.href} className="h-full">
              <Link
                href={tab.href}
                aria-label={tab.fullLabel}
                aria-current={active ? 'page' : undefined}
                className={`flex h-full flex-col items-center justify-center gap-0.5 transition-transform duration-150 active:scale-92 ${
                  active
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300'
                }`}
              >
                <Icon
                  className="h-[22px] w-[22px] shrink-0"
                  strokeWidth={active ? 2.35 : 1.8}
                />
                <span className="max-w-full truncate px-0.5 text-[9.5px] leading-none font-medium tracking-tighter sm:text-[10px] sm:tracking-tight">
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
