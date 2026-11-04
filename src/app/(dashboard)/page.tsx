'use client';

import React from 'react';
import Link from 'next/link';
import {
  Dumbbell,
  BookOpen,
  Utensils,
  Terminal,
  Flame,
  Clock,
  Play,
  Bell,
  TrendingUp,
  Sparkles,
  ChevronRight,
  Target,
  Zap,
} from 'lucide-react';
import { hapticImpact } from '@/lib/telegram/webapp';

export default function DashboardHomePage() {
  const quickActions = [
    {
      href: '/workouts',
      title: 'Тренировки',
      subtitle: 'Сплиты & сеты',
      icon: Dumbbell,
      badge: 'PRO GYM',
      color: '#C4F124',
      bg: 'bg-[#C4F124]/10 text-[#C4F124] border-[#C4F124]/25',
    },
    {
      href: '/nutrition',
      title: 'Питание',
      subtitle: 'КБЖУ & рацион',
      icon: Utensils,
      badge: 'MACROS',
      color: '#FF6D3B',
      bg: 'bg-[#FF6D3B]/10 text-[#FF6D3B] border-[#FF6D3B]/25',
    },
    {
      href: '/reading',
      title: 'Книги & Коран',
      subtitle: 'Аяты & чтение',
      icon: BookOpen,
      badge: 'SPIRIT',
      color: '#8A4FFF',
      bg: 'bg-[#8A4FFF]/10 text-[#8A4FFF] border-[#8A4FFF]/25',
    },
    {
      href: '/vibecoding',
      title: 'Вайбкодинг',
      subtitle: 'Спринты & код',
      icon: Terminal,
      badge: 'DEV',
      color: '#00D2FF',
      bg: 'bg-[#00D2FF]/10 text-[#00D2FF] border-[#00D2FF]/25',
    },
  ];

  // Дни недели для графика активности в стиле Pinterest Progress
  const weekDays = [
    { day: 'Пн', completed: true, val: 5 },
    { day: 'Вт', completed: true, val: 6 },
    { day: 'Ср', completed: false, val: 0 },
    { day: 'Чт', completed: true, val: 4 },
    { day: 'Пт', completed: true, val: 6 },
    { day: 'Сб', completed: false, val: 0 },
    { day: 'Вс', completed: false, val: 0 },
  ];

  return (
    <div className="space-y-4 pb-6">
      {/* 1. ШАПКА: ПРИВЕТСТВИЕ И СТАТУС В СТИЛЕ PINTEREST GYM UI */}
      <header className="flex items-center justify-between px-1 pt-1">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#8F90A6]">
            <span>Привет, Атлет</span>
            <span>👋</span>
          </div>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-[#FFFFFF]">
            Ready to crush your goals?
          </h1>
        </div>

        {/* Кнопка уведомлений с неоновой точкой активности */}
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/5 bg-[#16161C] shadow-lg shadow-black/60">
          <Bell className="h-5 w-5 text-[#8F90A6]" />
          <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-[#C4F124] shadow-[0_0_6px_#C4F124]" />
        </div>
      </header>

      {/* 2. КАРТОЧКА НЕДЕЛЬНОГО ПРОГРЕССА (WEEKLY PROGRESS HERO) */}
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-[#1C1C24] via-[#16161C] to-[#111116] p-4.5 shadow-2xl shadow-black/80">
        {/* Неоновый лаймовый декоративный блик */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-[#C4F124]/10 blur-3xl"
        />

        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#C4F124]/15 text-[#C4F124]">
              <Target className="h-3.5 w-3.5" />
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#FFFFFF]">
              Недельный прогресс
            </span>
          </div>
          <span className="rounded-full bg-[#C4F124]/15 px-2.5 py-0.5 font-mono text-[11px] font-black text-[#C4F124]">
            6 из 8 целей
          </span>
        </div>

        <div className="mt-4 grid grid-cols-12 items-center gap-3">
          {/* Круговой индикатор процента (Radial Progress Ring) */}
          <div className="col-span-5 flex flex-col items-center justify-center">
            <div className="relative flex h-24 w-24 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                {/* Фоновая окружность */}
                <path
                  className="stroke-white/10"
                  strokeWidth="3.4"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                {/* Лаймовая дуга прогресса (75%) */}
                <path
                  className="stroke-[#C4F124] transition-all duration-1000 ease-out"
                  strokeDasharray="75, 100"
                  strokeLinecap="round"
                  strokeWidth="3.6"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="font-mono text-xl font-black tracking-tight text-[#FFFFFF] tabular-nums">
                  75<span className="text-xs text-[#C4F124]">%</span>
                </span>
                <span className="text-[9px] font-bold text-[#8F90A6]">
                  6 / 8
                </span>
              </div>
            </div>
          </div>

          {/* Плашки калорий и времени активности */}
          <div className="col-span-7 space-y-2">
            {/* Калории */}
            <div className="flex items-center gap-2.5 rounded-2xl border border-white/5 bg-[#101014] p-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FF6D3B]/15 text-[#FF6D3B]">
                <Flame className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#8F90A6]">
                  Калории
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-sm font-black text-[#FFFFFF] tabular-nums">
                    2,350
                  </span>
                  <span className="font-mono text-[10px] text-[#8F90A6]">/ 3,000</span>
                </div>
              </div>
            </div>

            {/* Время активности / Фокус */}
            <div className="flex items-center gap-2.5 rounded-2xl border border-white/5 bg-[#101014] p-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#8A4FFF]/15 text-[#8A4FFF]">
                <Clock className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#8F90A6]">
                  Активность
                </span>
                <span className="font-mono text-sm font-black text-[#FFFFFF] tabular-nums">
                  4ч 30м
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. КАРТОЧКА СЕГОДНЯШНЕЙ ТРЕНИРОВКИ (TODAY'S WORKOUT HERO CARD) */}
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-b from-[#1C1C24] to-[#121217] p-5 shadow-2xl shadow-black/80">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#C4F124]">
            <Zap className="h-3 w-3 fill-current" />
            ТРЕНИРОВКА ДНЯ
          </span>
          <Link
            href="/workouts"
            onClick={() => hapticImpact('light')}
            className="text-[11px] font-bold text-[#8F90A6] transition hover:text-[#FFFFFF]"
          >
            Все тренировки →
          </Link>
        </div>

        <div className="mt-3">
          <h2 className="text-xl font-black tracking-tight text-[#FFFFFF] uppercase">
            Push Day · Силовой сплит
          </h2>
          <p className="mt-0.5 text-xs text-[#8F90A6]">
            Грудь, Плечи, Трицепс · База и изолирующие сеты
          </p>
        </div>

        {/* Метрики сплита */}
        <div className="mt-3.5 flex items-center gap-2">
          <span className="rounded-xl border border-white/5 bg-[#101014] px-2.5 py-1 font-mono text-[11px] font-bold text-[#FFFFFF]">
            8 упражнений
          </span>
          <span className="rounded-xl border border-white/5 bg-[#101014] px-2.5 py-1 font-mono text-[11px] font-bold text-[#FFFFFF]">
            45 мин
          </span>
          <span className="rounded-xl border border-white/5 bg-[#101014] px-2.5 py-1 font-mono text-[11px] font-bold text-[#FF6D3B]">
            ~320 ккал
          </span>
        </div>

        {/* ГЛАВНАЯ НЕОНОВО-ЛАЙМОВАЯ КНОПКА СТАРТА ТРЕНИРОВКИ */}
        <Link
          href="/workouts"
          onClick={() => hapticImpact('heavy')}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#C4F124] py-3.5 text-xs font-black tracking-wider text-black uppercase shadow-xl shadow-[#C4F124]/20 transition-all duration-150 active:scale-[0.98] hover:bg-[#b2dc1e]"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>Начать тренировку</span>
        </Link>
      </div>

      {/* 4. БЫСТРЫЕ ДЕЙСТВИЯ (QUICK ACTIONS) — СЕТКА 4 МОДУЛЕЙ */}
      <section className="space-y-2.5">
        <h2 className="px-1 text-xs font-black uppercase tracking-wider text-[#8F90A6]">
          Быстрый доступ
        </h2>

        <div className="grid grid-cols-2 gap-2.5">
          {quickActions.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => hapticImpact('light')}
                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/5 bg-[#16161C] p-4 shadow-xl shadow-black/60 transition-all duration-200 active:scale-[0.98] hover:border-white/10 hover:bg-[#1A1A22]"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-2xl border shadow-inner transition-transform duration-200 group-hover:scale-110 ${item.bg}`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={2.2} />
                  </span>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-[9px] font-bold text-[#8F90A6]">
                    {item.badge}
                  </span>
                </div>

                <div className="mt-3.5">
                  <h3 className="text-sm font-black text-[#FFFFFF] uppercase">
                    {item.title}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-[#8F90A6]">
                    {item.subtitle}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 5. ЧАСТОТА ТРЕНИРОВОК (WORKOUT FREQUENCY ПО ДНЯМ НЕДЕЛИ) */}
      <section className="rounded-3xl border border-white/5 bg-[#16161C] p-4 shadow-xl shadow-black/60">
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#C4F124]/15 text-[#C4F124]">
              <TrendingUp className="h-3.5 w-3.5" />
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#FFFFFF]">
              Частота тренировок
            </span>
          </div>
          <span className="font-mono text-xs font-bold text-[#C4F124]">
            4 сессии на этой неделе
          </span>
        </div>

        {/* Столбики дней недели как в Pinterest UI Kit */}
        <div className="mt-4 grid grid-cols-7 items-end gap-2 px-1">
          {weekDays.map((d, idx) => (
            <div key={idx} className="flex flex-col items-center gap-2">
              {d.completed && (
                <span className="font-mono text-[10px] font-black text-[#C4F124]">
                  {d.val}
                </span>
              )}
              <div
                className={`w-full rounded-full transition-all duration-300 ${
                  d.completed
                    ? 'h-16 bg-[#C4F124] shadow-[0_0_10px_rgba(196,241,36,0.35)]'
                    : 'h-6 bg-white/5'
                }`}
              />
              <span
                className={`font-mono text-[10px] font-bold ${
                  d.completed ? 'text-[#FFFFFF]' : 'text-[#8F90A6]/60'
                }`}
              >
                {d.day}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
