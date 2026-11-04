'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  Utensils,
  Check,
  Flame,
  Info,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Sun,
  Moon,
  Apple,
} from 'lucide-react';
import {
  DEFAULT_FOOD_CATALOG,
  calculatePortionMacros,
  parseMealDescription,
  type ParsedMealItem,
  type CalculatedMacros,
} from '@/features/nutrition/utils/macroParser';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { hapticImpact, hapticNotification } from '@/lib/telegram/webapp';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface DailyNutritionGoals {
  calories: number;
  protein: number;
  fats: number;
  carbs: number;
}

export interface LoggedMealSummary {
  id: string;
  mealType: MealType;
  title: string;
  recipeUrl?: string;
  macros: CalculatedMacros;
}

interface NutritionTrackerProps {
  dailyGoals?: DailyNutritionGoals;
  initialLoggedMeals?: LoggedMealSummary[];
  onSaveMeal?: (meal: {
    mealType: MealType;
    description: string;
    items: ParsedMealItem[];
    totals: CalculatedMacros;
  }) => Promise<void> | void;
}

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус',
};

const MEAL_ICONS: Record<MealType, React.ReactNode> = {
  breakfast: <Coffee className="h-4 w-4 text-[#FF6D3B]" />,
  lunch: <Sun className="h-4 w-4 text-[#C4F124]" />,
  dinner: <Moon className="h-4 w-4 text-[#8A4FFF]" />,
  snack: <Apple className="h-4 w-4 text-[#22C55E]" />,
};

const DEFAULT_GOALS: DailyNutritionGoals = {
  calories: 2400,
  protein: 160,
  fats: 80,
  carbs: 250,
};

export function NutritionTracker({
  dailyGoals = DEFAULT_GOALS,
  initialLoggedMeals = [
    {
      id: 'seed-breakfast',
      mealType: 'breakfast',
      title: 'Овсяная каша с ягодами и яйца',
      macros: { calories: 450, protein: 28, fats: 14, carbs: 54 },
    },
    {
      id: 'seed-lunch',
      mealType: 'lunch',
      title: 'Куриное филе на гриле со свежим салатом',
      macros: { calories: 650, protein: 55, fats: 18, carbs: 62 },
    },
    {
      id: 'seed-dinner',
      mealType: 'dinner',
      title: 'Лосось на пару с киноа и брокколи',
      macros: { calories: 750, protein: 48, fats: 26, carbs: 68 },
    },
  ],
  onSaveMeal,
}: NutritionTrackerProps) {
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [recipeUrl, setRecipeUrl] = useState<string>('');
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [quickInput, setQuickInput] = useState<string>(
    'Куриная грудка 200г, гречка отварная 180г, авокадо 50г'
  );

  // Список продуктов текущего редактируемого приема пищи
  const [items, setItems] = useState<ParsedMealItem[]>([]);

  // Уже записанные за сегодня приемы пищи
  const [loggedMeals, setLoggedMeals] =
    useState<LoggedMealSummary[]>(initialLoggedMeals);

  // Загрузка сохраненных за сегодня приемов пищи из localStorage
  useEffect(() => {
    try {
      const today = new Intl.DateTimeFormat('en-CA').format(new Date());
      const raw = localStorage.getItem(`ejednevnik_nutrition_${today}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLoggedMeals(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const [selectedCatalogId, setSelectedCatalogId] = useState<string>(
    DEFAULT_FOOD_CATALOG[0].id
  );

  // Мгновенный пересчет КБЖУ текущего приема пищи при любом изменении граммовки или нутриентов
  const currentMealTotals = useMemo<CalculatedMacros>(() => {
    return items.reduce<CalculatedMacros>(
      (acc, item) => {
        const portion = calculatePortionMacros(item.weightGrams, item);
        return {
          calories: Math.round((acc.calories + portion.calories) * 10) / 10,
          protein: Math.round((acc.protein + portion.protein) * 10) / 10,
          fats: Math.round((acc.fats + portion.fats) * 10) / 10,
          carbs: Math.round((acc.carbs + portion.carbs) * 10) / 10,
        };
      },
      { calories: 0, protein: 0, fats: 0, carbs: 0 }
    );
  }, [items]);

  // Сумма уже сохраненных за день приемов пищи
  const loggedDayTotals = useMemo<CalculatedMacros>(() => {
    return loggedMeals.reduce<CalculatedMacros>(
      (acc, meal) => ({
        calories: Math.round((acc.calories + meal.macros.calories) * 10) / 10,
        protein: Math.round((acc.protein + meal.macros.protein) * 10) / 10,
        fats: Math.round((acc.fats + meal.macros.fats) * 10) / 10,
        carbs: Math.round((acc.carbs + meal.macros.carbs) * 10) / 10,
      }),
      { calories: 0, protein: 0, fats: 0, carbs: 0 }
    );
  }, [loggedMeals]);

  // Прогнозируемый дневной итог с учетом текущей заполняемой формы
  const projectedTotals = useMemo<CalculatedMacros>(() => {
    return {
      calories:
        Math.round((loggedDayTotals.calories + currentMealTotals.calories) * 10) /
        10,
      protein:
        Math.round((loggedDayTotals.protein + currentMealTotals.protein) * 10) /
        10,
      fats:
        Math.round((loggedDayTotals.fats + currentMealTotals.fats) * 10) / 10,
      carbs:
        Math.round((loggedDayTotals.carbs + currentMealTotals.carbs) * 10) / 10,
    };
  }, [loggedDayTotals, currentMealTotals]);

  // Расчет кругового кольца калорий (Pinterest Circular Meter)
  const caloriePercent = Math.min(
    100,
    Math.round((projectedTotals.calories / (dailyGoals.calories || 2400)) * 100)
  );
  const strokeDashoffset = 283 - (283 * Math.min(100, caloriePercent)) / 100;

  // Обработка быстрого текстового ввода
  const handleParseText = () => {
    hapticImpact('medium');
    const parsed = parseMealDescription(quickInput);
    if (parsed.length > 0) {
      setItems((prev) => [...prev, ...parsed]);
      setQuickInput('');
    }
  };

  const handleAddFromCatalog = () => {
    hapticImpact('light');
    const found = DEFAULT_FOOD_CATALOG.find((c) => c.id === selectedCatalogId);
    if (!found) return;

    setItems((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        productName: found.name,
        weightGrams: 100,
        caloriesPer100g: found.caloriesPer100g,
        proteinPer100g: found.proteinPer100g,
        fatsPer100g: found.fatsPer100g,
        carbsPer100g: found.carbsPer100g,
        matchedFromCatalog: true,
      },
    ]);
  };

  const updateItemField = (
    id: string,
    field: keyof Pick<
      ParsedMealItem,
      | 'weightGrams'
      | 'caloriesPer100g'
      | 'proteinPer100g'
      | 'fatsPer100g'
      | 'carbsPer100g'
    >,
    rawValue: string
  ) => {
    const parsed = rawValue === '' ? 0 : Number(rawValue);
    const safeVal = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: safeVal } : item))
    );
  };

  const adjustWeight = (id: string, delta: number) => {
    hapticImpact('light');
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, weightGrams: Math.max(0, item.weightGrams + delta) }
          : item
      )
    );
  };

  const removeItem = (id: string) => {
    hapticImpact('light');
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Удаление приема пищи из истории
  const handleDeleteMeal = (mealId: string) => {
    hapticImpact('medium');
    setLoggedMeals((prev) => {
      const next = prev.filter((m) => m.id !== mealId);
      try {
        const today = new Intl.DateTimeFormat('en-CA').format(new Date());
        localStorage.setItem(`ejednevnik_nutrition_${today}`, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Сохранение приема пищи в дневной журнал
  const handleSaveMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    hapticImpact('medium');

    const summaryText = items
      .map((i) => `${i.productName} ${i.weightGrams}г`)
      .join(', ');

    if (onSaveMeal) {
      await onSaveMeal({
        mealType,
        description: summaryText,
        items,
        totals: currentMealTotals,
      });
    } else {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('nutrition_logs').insert({
            user_id: user.id,
            meal_date: new Intl.DateTimeFormat('en-CA').format(new Date()),
            meal_type: mealType,
            food_description: summaryText,
            calories: currentMealTotals.calories,
            protein: currentMealTotals.protein,
            fats: currentMealTotals.fats,
            carbs: currentMealTotals.carbs,
            recipe_url: recipeUrl.trim() || null,
            last_updated_by: 'web',
          });

          // Отправляем структурированное сообщение о КБЖУ в Telegram-бот
          void fetch('/api/telegram/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'nutrition',
              userId: user.id,
              data: {
                mealType,
                description: summaryText,
                calories: currentMealTotals.calories,
                protein: currentMealTotals.protein,
                fats: currentMealTotals.fats,
                carbs: currentMealTotals.carbs,
                recipeUrl: recipeUrl.trim() || undefined,
              },
            }),
          }).catch(() => null);
        }
      }
    }

    const newMealItem: LoggedMealSummary = {
      id: `${Date.now()}`,
      mealType,
      title: summaryText,
      recipeUrl: recipeUrl.trim() || undefined,
      macros: currentMealTotals,
    };

    setLoggedMeals((prev) => {
      const next = [...prev, newMealItem];
      try {
        const today = new Intl.DateTimeFormat('en-CA').format(new Date());
        localStorage.setItem(`ejednevnik_nutrition_${today}`, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    hapticNotification('success');
    setItems([]);
    setQuickInput('');
    setRecipeUrl('');
    setIsFormOpen(false);
  };

  return (
    <div className="space-y-4 pb-24">
      {/* 1. СЕЛЕКТОР ДАТЫ (PINTEREST STYLE: < Сегодня >) */}
      <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#16161C] px-4 py-2.5 shadow-sm">
        <button
          type="button"
          onClick={() => hapticImpact('light')}
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1C1C24] text-[#8F90A6] hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-black tracking-wider text-white uppercase">
          Сегодня
        </span>
        <button
          type="button"
          onClick={() => hapticImpact('light')}
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1C1C24] text-[#8F90A6] hover:text-white"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* 2. КРУГОВОЙ СЧЕТЧИК КАЛОРИЙ И МАКРОСЫ (PINTEREST NUTRITION SCREEN) */}
      <section className="relative overflow-hidden rounded-3xl border border-white/5 bg-[#16161C] p-5 shadow-2xl shadow-black/80">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#C4F124]/10 blur-3xl"
        />

        <div className="relative flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Левая часть: большой круговой радиальный индикатор калорий */}
          <div className="relative flex items-center justify-center">
            <svg className="h-44 w-44 -rotate-90 transform" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="#1C1C24"
                strokeWidth="7"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="url(#calorieGradient)"
                strokeWidth="7"
                strokeDasharray="264"
                strokeDashoffset={264 - (264 * Math.min(100, caloriePercent)) / 100}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
              />
              <defs>
                <linearGradient id="calorieGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#C4F124" />
                  <stop offset="50%" stopColor="#FF6D3B" />
                  <stop offset="100%" stopColor="#C4F124" />
                </linearGradient>
              </defs>
            </svg>

            {/* Текст в центре круга */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-mono text-3xl font-black text-white tabular-nums tracking-tight">
                {Math.round(projectedTotals.calories).toLocaleString('ru-RU')}
              </span>
              <span className="text-[11px] font-bold text-[#8F90A6]">
                / {dailyGoals.calories.toLocaleString('ru-RU')} kcal
              </span>
              <span className="mt-0.5 text-[10px] font-black uppercase tracking-wider text-[#C4F124]">
                Consumed
              </span>
            </div>
          </div>

          {/* Правая часть: 3 карточки макронутриентов с точками */}
          <div className="flex w-full sm:w-56 flex-col gap-2.5">
            {/* БЕЛКИ (Protein) */}
            <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#101014] p-3">
              <div className="flex items-center gap-2.5">
                <span className="h-3 w-3 rounded-full bg-[#22C55E] ring-2 ring-[#22C55E]/30" />
                <div>
                  <span className="block text-[10px] font-bold text-[#8F90A6] uppercase">
                    Protein
                  </span>
                  <span className="font-mono text-xs font-black text-white tabular-nums">
                    {Math.round(projectedTotals.protein)}g{' '}
                    <span className="text-[#8F90A6] font-normal">/ {dailyGoals.protein}g</span>
                  </span>
                </div>
              </div>
              <span className="font-mono text-xs font-black text-[#22C55E]">
                {Math.round((projectedTotals.protein / dailyGoals.protein) * 100)}%
              </span>
            </div>

            {/* УГЛЕВОДЫ (Carbs) */}
            <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#101014] p-3">
              <div className="flex items-center gap-2.5">
                <span className="h-3 w-3 rounded-full bg-[#FF6D3B] ring-2 ring-[#FF6D3B]/30" />
                <div>
                  <span className="block text-[10px] font-bold text-[#8F90A6] uppercase">
                    Carbs
                  </span>
                  <span className="font-mono text-xs font-black text-white tabular-nums">
                    {Math.round(projectedTotals.carbs)}g{' '}
                    <span className="text-[#8F90A6] font-normal">/ {dailyGoals.carbs}g</span>
                  </span>
                </div>
              </div>
              <span className="font-mono text-xs font-black text-[#FF6D3B]">
                {Math.round((projectedTotals.carbs / dailyGoals.carbs) * 100)}%
              </span>
            </div>

            {/* ЖИРЫ (Fat) */}
            <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#101014] p-3">
              <div className="flex items-center gap-2.5">
                <span className="h-3 w-3 rounded-full bg-[#8A4FFF] ring-2 ring-[#8A4FFF]/30" />
                <div>
                  <span className="block text-[10px] font-bold text-[#8F90A6] uppercase">
                    Fat
                  </span>
                  <span className="font-mono text-xs font-black text-white tabular-nums">
                    {Math.round(projectedTotals.fats)}g{' '}
                    <span className="text-[#8F90A6] font-normal">/ {dailyGoals.fats}g</span>
                  </span>
                </div>
              </div>
              <span className="font-mono text-xs font-black text-[#8A4FFF]">
                {Math.round((projectedTotals.fats / dailyGoals.fats) * 100)}%
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. СПИСОК ПРИЕМОВ ПИЩИ (PINTEREST MEALS LIST) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-black tracking-wider text-white uppercase">
            Meals (Приемы пищи)
          </h2>
          {/* Круглая неоново-лаймовая кнопка добавления блюда из Pinterest */}
          <button
            type="button"
            onClick={() => {
              hapticImpact('light');
              setIsFormOpen((prev) => !prev);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C4F124] text-black shadow-lg shadow-[#C4F124]/20 transition-transform hover:scale-105 active:scale-95"
            title="Добавить прием пищи"
          >
            <Plus className={`h-4 w-4 stroke-[3] transition-transform duration-200 ${isFormOpen ? 'rotate-45' : ''}`} />
          </button>
        </div>

        {/* Карточки приемов пищи */}
        <div className="space-y-2.5">
          {loggedMeals.map((meal) => (
            <div
              key={meal.id}
              className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#16161C] p-3.5 shadow-md transition hover:border-white/10"
            >
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1C1C24] ring-1 ring-white/5">
                  {MEAL_ICONS[meal.mealType] || <Utensils className="h-4 w-4 text-[#C4F124]" />}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-white">
                      {MEAL_TYPE_LABELS[meal.mealType]}
                    </span>
                    {meal.recipeUrl && (
                      <a
                        href={meal.recipeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#C4F124] hover:underline"
                      >
                        Рецепт <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                  <p className="line-clamp-1 text-[11px] font-medium text-[#8F90A6]">
                    {meal.title}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <span className="font-mono text-sm font-black text-white tabular-nums">
                    {Math.round(meal.macros.calories)} kcal
                  </span>
                  <p className="font-mono text-[10px] text-[#8F90A6] tabular-nums">
                    Б:{meal.macros.protein} Ж:{meal.macros.fats} У:{meal.macros.carbs}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteMeal(meal.id)}
                  aria-label="Удалить прием"
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-[#8F90A6] transition hover:bg-rose-950/40 hover:text-rose-400 active:scale-95"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. РАСКРЫВАЮЩАЯСЯ ФОРМА ДОБАВЛЕНИЯ ПРИЕМА ПИЩИ */}
      {isFormOpen && (
        <form
          onSubmit={handleSaveMeal}
          className="space-y-4 rounded-3xl border border-white/5 bg-[#16161C] p-5 shadow-2xl shadow-black/80 animate-in fade-in duration-200"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-xs font-black tracking-wider text-white uppercase">
              <Utensils className="h-4 w-4 text-[#C4F124]" />
              Новая запись рациона
            </h2>

            {/* Переключатель типа приема пищи */}
            <div className="inline-flex rounded-2xl border border-white/5 bg-[#101014] p-1 shadow-inner">
              {(Object.keys(MEAL_TYPE_LABELS) as MealType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    hapticImpact('light');
                    setMealType(type);
                  }}
                  className={`rounded-xl px-2.5 py-1 text-xs font-black transition active:scale-95 ${
                    mealType === type
                      ? 'bg-[#C4F124] text-black shadow-md shadow-[#C4F124]/15'
                      : 'text-[#8F90A6] hover:text-white'
                  }`}
                >
                  {MEAL_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          {/* Текстовый экспресс-парсер рациона */}
          <div className="rounded-2xl border border-[#C4F124]/20 bg-[#101014] p-3.5">
            <label className="mb-2 flex items-center gap-1.5 text-xs font-bold text-[#C4F124]">
              <Sparkles className="h-3.5 w-3.5" />
              Быстрый парсер продуктов (граммовка через запятую)
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                placeholder="Напр.: Творог 5% 200г, банан 120г, миндаль 30г"
                className="w-full rounded-xl border border-white/10 bg-[#16161C] px-3.5 py-2.5 text-sm text-white placeholder:text-[#8F90A6]/40 focus:border-[#C4F124] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleParseText}
                className="shrink-0 rounded-xl bg-[#C4F124] px-4 py-2.5 text-xs font-black text-black shadow-md shadow-[#C4F124]/15 transition hover:bg-[#b0db1f] active:scale-95"
              >
                Разобрать БЖУ
              </button>
            </div>
          </div>

          {/* Добавление продукта из справочника */}
          <div className="flex gap-2">
            <select
              value={selectedCatalogId}
              onChange={(e) => setSelectedCatalogId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#101014] px-3 py-2.5 text-xs font-medium text-white focus:border-[#C4F124] focus:outline-none"
            >
              {DEFAULT_FOOD_CATALOG.map((food) => (
                <option key={food.id} value={food.id} className="bg-[#16161C] text-white">
                  {food.name} ({food.caloriesPer100g} ккал / Б:{food.proteinPer100g} Ж:{food.fatsPer100g} У:{food.carbsPer100g})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddFromCatalog}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-white/5 bg-[#1C1C24] px-3.5 py-2 text-xs font-bold text-white transition hover:border-[#C4F124]/40 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5 text-[#C4F124]" />
              В список
            </button>
          </div>

          {/* Интерактивный список продуктов */}
          {items.length > 0 && (
            <div className="space-y-2.5">
              {items.map((item) => {
                const macros = calculatePortionMacros(item.weightGrams, item);

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-white/5 bg-[#101014] p-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-white">
                            {item.productName}
                          </span>
                          {!item.matchedFromCatalog && (
                            <span
                              title="Продукт не найден в словаре"
                              className="inline-flex items-center gap-0.5 rounded-md bg-[#8A4FFF]/20 px-1.5 py-0.5 text-[9px] font-bold text-[#8A4FFF]"
                            >
                              <Info className="h-2.5 w-2.5" />
                              свой БЖУ
                            </span>
                          )}
                        </div>
                        <p className="mt-1 font-mono text-[11px] text-[#8F90A6] tabular-nums">
                          Порция:{' '}
                          <strong className="font-black text-[#C4F124]">
                            {macros.calories} ккал
                          </strong>{' '}
                          · Б: {macros.protein}г · Ж: {macros.fats}г · У: {macros.carbs}г
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        aria-label="Удалить продукт"
                        className="rounded-lg p-1 text-[#8F90A6] transition hover:bg-rose-500/15 hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Управление граммовкой */}
                    <div className="mt-2.5 flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => adjustWeight(item.id, -25)}
                          className="rounded-lg border border-white/5 bg-[#1C1C24] px-2.5 py-1 font-mono text-xs font-bold text-white tabular-nums transition hover:border-[#C4F124]/30 active:scale-95"
                        >
                          -25г
                        </button>

                        <div className="relative w-24">
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step={5}
                            value={item.weightGrams || ''}
                            onChange={(e) =>
                              updateItemField(
                                item.id,
                                'weightGrams',
                                e.target.value
                              )
                            }
                            className="w-full rounded-xl border border-white/10 bg-[#16161C] py-1 pr-6 pl-2 text-center font-mono text-sm font-bold text-white tabular-nums focus:border-[#C4F124] focus:outline-none"
                          />
                          <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-[#8F90A6]">
                            г
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => adjustWeight(item.id, 25)}
                          className="rounded-lg border border-white/5 bg-[#1C1C24] px-2.5 py-1 font-mono text-xs font-bold text-white tabular-nums transition hover:border-[#C4F124]/30 active:scale-95"
                        >
                          +25г
                        </button>
                      </div>

                      <span className="font-mono text-[10px] text-[#8F90A6] tabular-nums">
                        100г = {item.caloriesPer100g} ккал
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Итог по текущему приему пищи */}
              <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#16161C] px-4 py-3 text-xs">
                <span className="font-bold text-[#8F90A6] uppercase tracking-wide">
                  Итого за {MEAL_TYPE_LABELS[mealType].toLowerCase()}:
                </span>
                <span className="font-mono font-black text-[#C4F124] tabular-nums">
                  {currentMealTotals.calories} ккал · Б {currentMealTotals.protein} · Ж {currentMealTotals.fats} · У {currentMealTotals.carbs}
                </span>
              </div>
            </div>
          )}

          {/* Ссылка на рецепт */}
          <div>
            <input
              type="url"
              value={recipeUrl}
              onChange={(e) => setRecipeUrl(e.target.value)}
              placeholder="Ссылка на рецепт (необязательно): https://..."
              className="w-full rounded-2xl border border-white/10 bg-[#101014] px-3.5 py-2.5 text-xs text-white placeholder:text-[#8F90A6]/40 focus:border-[#C4F124] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={items.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#C4F124] py-3.5 text-xs font-black tracking-wider text-black uppercase shadow-xl shadow-[#C4F124]/20 transition hover:bg-[#b0db1f] active:scale-[0.98] disabled:opacity-40"
          >
            <Check className="h-4 w-4 stroke-[3]" />
            Записать в дневник питания
          </button>
        </form>
      )}
    </div>
  );
}
