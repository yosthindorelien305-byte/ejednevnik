'use client';

import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  Utensils,
  Check,
  Flame,
  Info,
} from 'lucide-react';
import {
  DEFAULT_FOOD_CATALOG,
  calculatePortionMacros,
  parseMealDescription,
  type ParsedMealItem,
  type CalculatedMacros,
} from '@/features/nutrition/utils/macroParser';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

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

  // Прогноз за день (уже съедено + текущий вводимый прием пищи) для живых прогресс-баров
  const projectedTotals = useMemo<CalculatedMacros>(
    () => ({
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
    }),
    [loggedDayTotals, currentMealTotals]
  );

  // Запуск парсера текстовой строки рациона
  const handleParseText = () => {
    if (!quickInput.trim()) return;
    const parsed = parseMealDescription(quickInput);
    if (parsed.length > 0) {
      setItems(parsed);
    }
  };

  // Добавление продукта из быстрого каталога
  const handleAddFromCatalog = () => {
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
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, weightGrams: Math.max(0, item.weightGrams + delta) }
          : item
      )
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Сохранение приема пищи в дневной журнал
  const handleSaveMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

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
        }
      }
    }

    setLoggedMeals((prev) => [
      ...prev,
      {
        id: `${Date.now()}`,
        mealType,
        title: summaryText,
        recipeUrl: recipeUrl.trim() || undefined,
        macros: currentMealTotals,
      },
    ]);

    setItems([]);
    setQuickInput('');
    setRecipeUrl('');
  };

  return (
    <div className="space-y-5">
      {/* Блок прогресс-баров суточной нормы КБЖУ */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <Flame className="h-4 w-4 text-orange-500" />
              Дневная норма КБЖУ
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Сплошная шкала — съедено, полупрозрачная — текущий ввод
            </p>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {Math.round(projectedTotals.calories)}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
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
          barColor="bg-emerald-500"
          previewColor="bg-emerald-500/35"
        />

        {/* Прогресс-бары Белков, Жиров и Углеводов */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MacroProgressBar
            label="Белки"
            unit="г"
            logged={loggedDayTotals.protein}
            projected={projectedTotals.protein}
            goal={dailyGoals.protein}
            barColor="bg-sky-500"
            previewColor="bg-sky-500/35"
          />
          <MacroProgressBar
            label="Жиры"
            unit="г"
            logged={loggedDayTotals.fats}
            projected={projectedTotals.fats}
            goal={dailyGoals.fats}
            barColor="bg-amber-500"
            previewColor="bg-amber-500/35"
          />
          <MacroProgressBar
            label="Углеводы"
            unit="г"
            logged={loggedDayTotals.carbs}
            projected={projectedTotals.carbs}
            goal={dailyGoals.carbs}
            barColor="bg-violet-500"
            previewColor="bg-violet-500/35"
          />
        </div>
      </section>

      {/* Форма ввода приема пищи и калькулятор граммовок */}
      <form
        onSubmit={handleSaveMeal}
        className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <Utensils className="h-4 w-4 text-emerald-500" />
            Добавить прием пищи
          </h2>

          {/* Переключатель типа приема пищи */}
          <div className="flex flex-wrap rounded-xl bg-zinc-100 p-0.5 dark:bg-zinc-800">
            {(Object.keys(MEAL_TYPE_LABELS) as MealType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setMealType(type)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  mealType === type
                    ? 'bg-white text-emerald-700 shadow-2xs dark:bg-zinc-900 dark:text-emerald-400'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {MEAL_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        {/* Текстовый экспресс-парсер рациона */}
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-50/50 p-3 dark:bg-emerald-950/20">
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            <Sparkles className="h-3.5 w-3.5" />
            Быстрый парсер рациона (через запятую с граммовкой)
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder="Напр.: Творог 5% 200г, банан 120г, финики 40г"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={handleParseText}
              className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 active:scale-95"
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
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-800 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          >
            {DEFAULT_FOOD_CATALOG.map((food) => (
              <option key={food.id} value={food.id}>
                {food.name} ({food.caloriesPer100g} ккал / Б:{food.proteinPer100g}{' '}
                Ж:{food.fatsPer100g} У:{food.carbsPer100g})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddFromCatalog}
            className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          >
            <Plus className="h-3.5 w-3.5" />В список
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
                  className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-800/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {item.productName}
                        </span>
                        {!item.matchedFromCatalog && (
                          <span
                            title="Продукт не найден в базовом словаре — проверьте БЖУ на 100 г"
                            className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300"
                          >
                            <Info className="h-3 w-3" />
                            свой БЖУ
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                        Порция:{' '}
                        <strong className="text-zinc-800 dark:text-zinc-200">
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
                      className="rounded-lg p-1 text-zinc-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Управление граммовкой с мгновенным пересчетом */}
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => adjustWeight(item.id, -25)}
                        className="rounded-lg bg-zinc-200/80 px-2 py-1 text-xs font-semibold text-zinc-700 active:scale-95 dark:bg-zinc-700 dark:text-zinc-200"
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
                          className="w-full rounded-lg border border-zinc-300 bg-white py-1 pr-6 pl-2 text-center text-sm font-bold text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-zinc-400">
                          г
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => adjustWeight(item.id, 25)}
                        className="rounded-lg bg-zinc-200/80 px-2 py-1 text-xs font-semibold text-zinc-700 active:scale-95 dark:bg-zinc-700 dark:text-zinc-200"
                      >
                        +25г
                      </button>
                    </div>

                    <span className="text-[11px] text-zinc-400">
                      на 100г: {item.caloriesPer100g} ккал
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Итог по текущему приему пищи */}
            <div className="flex items-center justify-between rounded-xl bg-zinc-100 px-3.5 py-2.5 text-xs dark:bg-zinc-800">
              <span className="font-medium text-zinc-600 dark:text-zinc-300">
                Итого за {MEAL_TYPE_LABELS[mealType].toLowerCase()}:
              </span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100">
                {currentMealTotals.calories} ккал · Б {currentMealTotals.protein} ·
                Ж {currentMealTotals.fats} · У {currentMealTotals.carbs}
              </span>
            </div>
          </div>
        ) : (
          <p className="py-3 text-center text-xs text-zinc-400">
            Введите рацион строкой выше или выберите продукт из справочника
          </p>
        )}

        {/* Опциональная ссылка на рецепт (YouTube, статья, Telegram-пост) */}
        <div>
          <input
            type="url"
            value={recipeUrl}
            onChange={(e) => setRecipeUrl(e.target.value)}
            placeholder="Ссылка на рецепт (необязательно): https://..."
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        <button
          type="submit"
          disabled={items.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-45"
        >
          <Check className="h-4 w-4" />
          Записать в дневник питания
        </button>
      </form>

      {/* История записанных приемов пищи за день */}
      {loggedMeals.length > 0 && (
        <section className="space-y-2">
          <h3 className="px-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            Записано сегодня
          </h3>
          {loggedMeals.map((meal) => (
            <div
              key={meal.id}
              className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-xs dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="pr-3">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {MEAL_TYPE_LABELS[meal.mealType]}
                </span>
                <p className="mt-0.5 line-clamp-1 text-zinc-600 dark:text-zinc-300">
                  {meal.title}
                </p>
                {meal.recipeUrl && (
                  <a
                    href={meal.recipeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-block text-[11px] font-medium text-emerald-600 underline dark:text-emerald-400"
                  >
                    Ссылка на рецепт →
                  </a>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="font-bold text-zinc-900 dark:text-zinc-100">
                  {meal.macros.calories} ккал
                </p>
                <p className="text-[11px] text-zinc-400">
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
    <div className="mt-2.5">
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </span>
        <span
          className={`font-semibold ${
            isOverLimit
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-zinc-600 dark:text-zinc-400'
          }`}
        >
          {Math.round(projected * 10) / 10} / {goal} {unit} (
          {Math.round((projected / safeGoal) * 100)}%)
        </span>
      </div>

      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
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
