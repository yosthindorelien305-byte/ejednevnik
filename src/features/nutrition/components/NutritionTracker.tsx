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

const DEFAULT_GOALS: DailyNutritionGoals = {
  calories: 2200,
  protein: 150,
  fats: 70,
  carbs: 240,
};

export function NutritionTracker({
  dailyGoals = DEFAULT_GOALS,
  initialLoggedMeals = [
    {
      id: 'seed-breakfast',
      mealType: 'breakfast',
      title: 'Овсяные хлопья 70г, Яйца куриные 120г, Банан 100г',
      macros: { calories: 533.6, protein: 24.7, fats: 19.1, carbs: 72.2 },
    },
  ],
  onSaveMeal,
}: NutritionTrackerProps) {
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [recipeUrl, setRecipeUrl] = useState<string>('');
  const [quickInput, setQuickInput] = useState<string>(
    'Куриная грудка 200г, гречка отварная 180г, авокадо 50г'
  );

  // Список продуктов текущего редактируемого приема пищи
  const [items, setItems] = useState<ParsedMealItem[]>(() =>
    parseMealDescription('Куриная грудка 200г, гречка отварная 180г, авокадо 50г')
  );

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

  // Обработка быстрого текстового ввода («курица 200г, рис 150г, огурец 100г»)
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

  // Обновление граммовки или нутриентов конкретного продукта в списке
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
  };

  return (
    <div className="space-y-4">
      {/* 1. БЛОК ДНЕВНОЙ НОРМЫ КБЖУ В СТИЛЕ FITFUSION DARK LUXURY */}
      <section className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-[#26211F] via-[#201C1A] to-[#141211] p-5 shadow-2xl shadow-black/60">
        {/* Фоновый мягкий блик */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[#F5BA42]/10 blur-3xl"
        />

        <div className="relative flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-1.5 text-xs font-black tracking-wider text-[#FAF7F5] uppercase">
              <Flame className="h-4 w-4 text-[#F5BA42]" />
              Дневная норма КБЖУ
            </h2>
            <p className="mt-0.5 text-[11px] text-[#A8A199]">
              Сплошная шкала — съедено, полупрозрачная — текущий ввод
            </p>
          </div>
          <div className="text-right">
            <span className="font-mono text-2xl font-black text-[#F5BA42] tabular-nums">
              {Math.round(projectedTotals.calories)}
            </span>
            <span className="font-mono text-xs font-bold text-[#A8A199] tabular-nums">
              {' '}
              / {dailyGoals.calories} ккал
            </span>
          </div>
        </div>

        {/* Главный прогресс-бар калорий */}
        <MacroProgressBar
          label="Калории"
          unit="ккал"
          logged={loggedDayTotals.calories}
          projected={projectedTotals.calories}
          goal={dailyGoals.calories}
          barColor="bg-gradient-to-r from-[#F5BA42] via-[#f7cb68] to-[#F5BA42]"
          previewColor="bg-[#F5BA42]/35"
        />

        {/* Прогресс-бары Белков, Жиров и Углеводов */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MacroProgressBar
            label="Белки"
            unit="г"
            logged={loggedDayTotals.protein}
            projected={projectedTotals.protein}
            goal={dailyGoals.protein}
            barColor="bg-gradient-to-r from-[#9e2240] via-[#bf2c4f] to-[#7a1830]"
            previewColor="bg-[#9e2240]/40"
          />
          <MacroProgressBar
            label="Жиры"
            unit="г"
            logged={loggedDayTotals.fats}
            projected={projectedTotals.fats}
            goal={dailyGoals.fats}
            barColor="bg-gradient-to-r from-[#d9942a] via-[#e5aa32] to-[#F5BA42]"
            previewColor="bg-[#d9942a]/40"
          />
          <MacroProgressBar
            label="Углеводы"
            unit="г"
            logged={loggedDayTotals.carbs}
            projected={projectedTotals.carbs}
            goal={dailyGoals.carbs}
            barColor="bg-gradient-to-r from-[#a35332] via-[#bd623c] to-[#873e21]"
            previewColor="bg-[#a35332]/40"
          />
        </div>
      </section>

      {/* 2. ФОРМА ДОБАВЛЕНИЯ ПРИЕМА ПИЩИ */}
      <form
        onSubmit={handleSaveMeal}
        className="space-y-4 rounded-3xl border border-white/5 bg-[#24201E] p-5 shadow-2xl shadow-black/50"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-xs font-black tracking-wider text-[#FAF7F5] uppercase">
            <Utensils className="h-4 w-4 text-[#F5BA42]" />
            Добавить прием пищи
          </h2>

          {/* Переключатель типа приема пищи */}
          <div className="inline-flex rounded-2xl border border-white/5 bg-[#1E1A18] p-1 shadow-inner">
            {(Object.keys(MEAL_TYPE_LABELS) as MealType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  hapticImpact('light');
                  setMealType(type);
                }}
                className={`rounded-xl px-2.5 py-1 text-xs font-bold transition active:scale-95 ${
                  mealType === type
                    ? 'bg-[#F5BA42] text-stone-950 shadow-md shadow-[#F5BA42]/15'
                    : 'text-[#A8A199] hover:text-[#FAF7F5]'
                }`}
              >
                {MEAL_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        {/* Текстовый экспресс-парсер рациона (бордовая подложка с золотыми акцентами) */}
        <div className="rounded-2xl border border-[#5B1626]/50 bg-gradient-to-br from-[#29171b] via-[#1E1A18] to-[#141211] p-3.5 shadow-inner">
          <label className="mb-2 flex items-center gap-1.5 text-xs font-bold text-[#F5BA42]">
            <Sparkles className="h-3.5 w-3.5" />
            Быстрый парсер рациона (через запятую с граммовкой)
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder="Напр.: Творог 5% 200г, банан 120г, финики 40г"
              className="w-full rounded-xl border border-white/10 bg-[#141211] px-3.5 py-2.5 text-sm text-[#FAF7F5] placeholder:text-stone-500 focus:border-[#F5BA42] focus:outline-none"
            />
            <button
              type="button"
              onClick={handleParseText}
              className="shrink-0 rounded-xl bg-[#F5BA42] px-4 py-2.5 text-xs font-bold text-stone-950 shadow-md shadow-[#F5BA42]/15 transition hover:bg-[#e5aa32] active:scale-95"
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
            className="w-full rounded-xl border border-white/10 bg-[#1A1615] px-3 py-2.5 text-xs font-medium text-[#FAF7F5] focus:border-[#F5BA42] focus:outline-none"
          >
            {DEFAULT_FOOD_CATALOG.map((food) => (
              <option key={food.id} value={food.id} className="bg-[#1A1615] text-[#FAF7F5]">
                {food.name} ({food.caloriesPer100g} ккал / Б:{food.proteinPer100g}{' '}
                Ж:{food.fatsPer100g} У:{food.carbsPer100g})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddFromCatalog}
            className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-white/5 bg-[#1E1A18] px-3.5 py-2 text-xs font-bold text-[#FAF7F5] transition hover:border-[#F5BA42]/40 active:scale-95"
          >
            <Plus className="h-3.5 w-3.5 text-[#F5BA42]" />В список
          </button>
        </div>

        {/* Интерактивный список продуктов с живым пересчетом от граммовки */}
        {items.length > 0 ? (
          <div className="space-y-2.5">
            {items.map((item) => {
              const macros = calculatePortionMacros(item.weightGrams, item);

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/5 bg-[#1E1A18] p-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-[#FAF7F5]">
                          {item.productName}
                        </span>
                        {!item.matchedFromCatalog && (
                          <span
                            title="Продукт не найден в словаре"
                            className="inline-flex items-center gap-0.5 rounded-md bg-[#5B1626] px-1.5 py-0.5 text-[9px] font-bold text-[#F5BA42]"
                          >
                            <Info className="h-2.5 w-2.5" />
                            свой БЖУ
                          </span>
                        )}
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-[#A8A199] tabular-nums">
                        Порция:{' '}
                        <strong className="font-bold text-[#F5BA42]">
                          {macros.calories} ккал
                        </strong>{' '}
                        · Б: {macros.protein}г · Ж: {macros.fats}г · У:{' '}
                        {macros.carbs}г
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      aria-label="Удалить продукт"
                      className="rounded-lg p-1 text-stone-500 transition hover:bg-rose-500/15 hover:text-rose-400"
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
                        className="rounded-lg border border-white/5 bg-[#24201E] px-2.5 py-1 font-mono text-xs font-bold text-[#FAF7F5] tabular-nums transition hover:border-[#F5BA42]/30 active:scale-95"
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
                          className="w-full rounded-xl border border-white/10 bg-[#141211] py-1 pr-6 pl-2 text-center font-mono text-sm font-bold text-[#FAF7F5] tabular-nums focus:border-[#F5BA42] focus:outline-none"
                        />
                        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-[#A8A199]">
                          г
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => adjustWeight(item.id, 25)}
                        className="rounded-lg border border-white/5 bg-[#24201E] px-2.5 py-1 font-mono text-xs font-bold text-[#FAF7F5] tabular-nums transition hover:border-[#F5BA42]/30 active:scale-95"
                      >
                        +25г
                      </button>
                    </div>

                    <span className="font-mono text-[10px] text-[#A8A199] tabular-nums">
                      100г = {item.caloriesPer100g} ккал
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Итог по текущему приему пищи */}
            <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#141211] px-4 py-3 text-xs">
              <span className="font-bold text-[#A8A199] uppercase tracking-wide">
                Итого за {MEAL_TYPE_LABELS[mealType].toLowerCase()}:
              </span>
              <span className="font-mono font-bold text-[#F5BA42] tabular-nums">
                {currentMealTotals.calories} ккал · Б {currentMealTotals.protein} ·
                Ж {currentMealTotals.fats} · У {currentMealTotals.carbs}
              </span>
            </div>
          </div>
        ) : (
          <p className="py-3 text-center text-xs text-[#A8A199]">
            Введите рацион строкой выше или выберите продукт из справочника
          </p>
        )}

        {/* Ссылка на рецепт */}
        <div>
          <input
            type="url"
            value={recipeUrl}
            onChange={(e) => setRecipeUrl(e.target.value)}
            placeholder="Ссылка на рецепт (необязательно): https://..."
            className="w-full rounded-2xl border border-white/10 bg-[#1A1615] px-3.5 py-2.5 text-xs text-[#FAF7F5] placeholder:text-stone-500 focus:border-[#F5BA42] focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={items.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#F5BA42] py-3.5 text-xs font-black tracking-wider text-stone-950 uppercase shadow-xl shadow-[#F5BA42]/20 transition hover:bg-[#e5aa32] active:scale-[0.98] disabled:opacity-40"
        >
          <Check className="h-4 w-4" />
          Записать в дневник питания
        </button>
      </form>

      {/* 3. ИСТОРИЯ ЗАПИСАННЫХ ЗА СЕГОДНЯ ПРИЕМОВ ПИЩИ */}
      {loggedMeals.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black tracking-wider text-[#A8A199] uppercase">
              Записано сегодня
            </h3>
            <span className="font-mono text-[10px] text-[#A8A199] tabular-nums">
              {loggedMeals.length} приемов
            </span>
          </div>

          {loggedMeals.map((meal) => (
            <div
              key={meal.id}
              className="flex items-center justify-between rounded-3xl border border-white/5 bg-[#24201E] px-4 py-3.5 shadow-xl shadow-black/40"
            >
              <div className="min-w-0 pr-3">
                <span className="inline-flex items-center rounded-full bg-[#5B1626] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#F5BA42]">
                  {MEAL_TYPE_LABELS[meal.mealType]}
                </span>
                <p className="mt-1 line-clamp-1 text-xs font-medium text-[#FAF7F5]">
                  {meal.title}
                </p>
                {meal.recipeUrl && (
                  <a
                    href={meal.recipeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[#F5BA42] hover:underline"
                  >
                    Рецепт <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-sm font-black text-[#F5BA42] tabular-nums">
                  {meal.macros.calories} ккал
                </p>
                <p className="font-mono text-[10px] text-[#A8A199] tabular-nums">
                  Б:{meal.macros.protein} Ж:{meal.macros.fats} У:{meal.macros.carbs}
                </p>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

// Подкомпонент шкалы выполнения суточной нормы нутриента
function MacroProgressBar({
  label,
  unit,
  logged,
  projected,
  goal,
  barColor,
  previewColor,
}: {
  label: string;
  unit: string;
  logged: number;
  projected: number;
  goal: number;
  barColor: string;
  previewColor: string;
}) {
  const safeGoal = goal > 0 ? goal : 1;
  const loggedPct = Math.min(100, Math.round((logged / safeGoal) * 100));
  const projectedPct = Math.min(100, Math.round((projected / safeGoal) * 100));
  const isOverLimit = projected > safeGoal;

  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span className="font-bold text-[#FAF7F5] uppercase tracking-wide text-[11px]">
          {label}
        </span>
        <span
          className={`font-mono text-[11px] font-bold tabular-nums ${
            isOverLimit ? 'text-rose-400' : 'text-[#A8A199]'
          }`}
        >
          <strong className="text-[#FAF7F5]">{Math.round(projected * 10) / 10}</strong> / {goal} {unit}{' '}
          <span className="text-[#F5BA42]">({Math.round((projected / safeGoal) * 100)}%)</span>
        </span>
      </div>

      <div className="relative h-2 w-full overflow-hidden rounded-full bg-[#141211] ring-1 ring-white/5">
        {/* Предпросмотр с учетом редактируемой формы */}
        <div
          style={{ width: `${projectedPct}%` }}
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
            isOverLimit ? 'bg-rose-500/40' : previewColor
          }`}
        />
        {/* Уже сохраненный прогресс за день */}
        <div
          style={{ width: `${loggedPct}%` }}
          className={`relative h-full rounded-full transition-all duration-300 ${
            isOverLimit ? 'bg-rose-500' : barColor
          }`}
        />
      </div>
    </div>
  );
}