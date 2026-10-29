import Link from 'next/link';
import {
  Dumbbell,
  BookOpen,
  Utensils,
  Terminal,
  ChevronRight,
} from 'lucide-react';

// Главный экран «Главная / Сводка» в стиле iOS Large Title
export default function DashboardHomePage() {
  const sections = [
    {
      href: '/workouts',
      title: 'Тренировки',
      subtitle: 'Силовые подходы, тоннаж и фото формы с камеры iPhone',
      icon: Dumbbell,
      accent: 'text-emerald-600 bg-emerald-500/15 dark:text-emerald-400',
    },
    {
      href: '/reading',
      title: 'Книги и Коран',
      subtitle: 'Страницы, аяты, ссылки на материалы и скриншоты',
      icon: BookOpen,
      accent: 'text-sky-600 bg-sky-500/15 dark:text-sky-400',
    },
    {
      href: '/nutrition',
      title: 'Питание',
      subtitle: 'Рацион, ссылки на рецепты и расчет КБЖУ за день',
      icon: Utensils,
      accent: 'text-amber-600 bg-amber-500/15 dark:text-amber-400',
    },
    {
      href: '/vibecoding',
      title: 'Вайбкодинг',
      subtitle: 'Заметки по коду, полезные ссылки и трекер проектов',
      icon: Terminal,
      accent: 'text-violet-600 bg-violet-500/15 dark:text-violet-400',
    },
  ];

  return (
    <div className="space-y-5">
      <header className="px-0.5">
        <p className="text-xs font-semibold tracking-wide text-emerald-600 uppercase dark:text-emerald-400">
          Сводка дня
        </p>
        <h1 className="mt-0.5 text-3xl font-bold tracking-tight">Главная</h1>
      </header>

      <div className="divide-y divide-zinc-100 overflow-hidden rounded-3xl border border-zinc-200/90 bg-white shadow-xs dark:divide-zinc-800/80 dark:border-zinc-800 dark:bg-zinc-900">
        {sections.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between gap-3 p-4 transition active:bg-zinc-100 dark:active:bg-zinc-800/70"
            >
              <div className="flex items-center gap-3.5">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${item.accent}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {item.title}
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {item.subtitle}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
