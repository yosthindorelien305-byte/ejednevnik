'use client';

import Link from 'next/link';
import {
  Dumbbell,
  BookOpen,
  Utensils,
  Terminal,
  ChevronRight,
  Flame,
  Sparkles,
} from 'lucide-react';
import { hapticImpact } from '@/lib/telegram/webapp';

export default function DashboardHomePage() {
  const sections = [
    {
      href: '/workouts',
      title: 'Тренировки',
      subtitle: 'Силовые сплиты, тоннаж и фото формы с камеры',
      badge: 'СИЛА & ТОННАЖ',
      icon: Dumbbell,
      accentBg: 'bg-[#F5BA42]/10 text-[#F5BA42] ring-1 ring-[#F5BA42]/20',
      badgeBg: 'bg-[#F5BA42] text-stone-950',
    },
    {
      href: '/reading',
      title: 'Книги и Коран',
      subtitle: 'Страницы, аяты, тадаббур и ссылки на тафсир',
      badge: 'ДУХОВНОСТЬ',
      icon: BookOpen,
      accentBg: 'bg-[#5B1626]/40 text-rose-300 ring-1 ring-rose-500/20',
      badgeBg: 'bg-[#5B1626] text-rose-100',
    },
    {
      href: '/nutrition',
      title: 'Рацион и КБЖУ',
      subtitle: 'Калории, белки, жиры и углеводы за день',
      badge: 'ПИТАНИЕ',
      icon: Utensils,
      accentBg: 'bg-[#F5BA42]/10 text-[#F5BA42] ring-1 ring-[#F5BA42]/20',
      badgeBg: 'bg-[#F5BA42] text-stone-950',
    },
    {
      href: '/vibecoding',
      title: 'Вайбкодинг',
      subtitle: 'Пет-проекты, идеи кода и база полезных ссылок',
      badge: 'DEVELOPMENT',
      icon: Terminal,
      accentBg: 'bg-white/5 text-[#FAF7F5] ring-1 ring-white/10',
      badgeBg: 'bg-[#24201E] text-[#FAF7F5] border border-white/10',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Шапка главного экрана в стиле FitFusion Luxury */}
      <header className="flex items-center justify-between px-1">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F5BA42] px-2.5 py-0.5 text-[10px] font-black tracking-wider text-stone-950 uppercase">
              <Sparkles className="h-3 w-3" />
              FitFusion Luxury
            </span>
          </div>
          <h1 className="mt-1.5 text-2xl font-black tracking-tight text-[#FAF7F5] uppercase">
            Главная / Сводка
          </h1>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/5 bg-gradient-to-br from-[#26211F] to-[#1D1918] shadow-lg shadow-black/40">
          <Flame className="h-5 w-5 text-[#F5BA42]" />
        </div>
      </header>

      {/* Список основных модулей в премиальных графитовых карточках */}
      <div className="space-y-3">
        {sections.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => hapticImpact('light')}
              className="group relative flex items-center justify-between gap-3 overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-r from-[#26211F] to-[#1D1918] p-4.5 shadow-xl shadow-black/40 transition-all duration-200 active:scale-[0.98] hover:border-white/10"
            >
              <div className="flex items-center gap-3.5">
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-inner transition-transform duration-200 group-hover:scale-105 ${item.accentBg}`}
                >
                  <Icon className="h-5 w-5" strokeWidth={2.2} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-black tracking-tight text-[#FAF7F5] uppercase">
                      {item.title}
                    </h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${item.badgeBg}`}
                    >
                      {item.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#A8A199] leading-snug">
                    {item.subtitle}
                  </p>
                </div>
              </div>

              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/5 text-[#A8A199] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[#FAF7F5]">
                <ChevronRight className="h-4 w-4" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
