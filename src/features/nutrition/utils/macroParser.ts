// Справочник базовых продуктов (КБЖУ на 100 грамм) и парсер быстрого ввода рациона

export interface FoodReference {
  id: string;
  name: string;
  keywords: string[];
  caloriesPer100g: number;
  proteinPer100g: number;
  fatsPer100g: number;
  carbsPer100g: number;
}

export interface CalculatedMacros {
  calories: number;
  protein: number;
  fats: number;
  carbs: number;
}

export interface ParsedMealItem {
  id: string;
  productName: string;
  weightGrams: number;
  caloriesPer100g: number;
  proteinPer100g: number;
  fatsPer100g: number;
  carbsPer100g: number;
  matchedFromCatalog: boolean;
}

// Базовый словарь продуктов для мгновенного локального парсинга и автодополнения
export const DEFAULT_FOOD_CATALOG: FoodReference[] = [
  {
    id: 'chicken-breast',
    name: 'Куриная грудка (филе)',
    keywords: ['куриная грудка', 'грудка', 'курогрудка', 'куриное филе', 'курица'],
    caloriesPer100g: 113,
    proteinPer100g: 23.6,
    fatsPer100g: 1.9,
    carbsPer100g: 0.4,
  },
  {
    id: 'beef-lean',
    name: 'Говядина постная',
    keywords: ['говядина', 'телятина', 'стейк'],
    caloriesPer100g: 158,
    proteinPer100g: 22.2,
    fatsPer100g: 7.1,
    carbsPer100g: 0,
  },
  {
    id: 'salmon',
    name: 'Лосось / Семга',
    keywords: ['лосось', 'семга', 'форель', 'красная рыба'],
    caloriesPer100g: 208,
    proteinPer100g: 20.4,
    fatsPer100g: 13.4,
    carbsPer100g: 0,
  },
  {
    id: 'eggs',
    name: 'Яйца куриные',
    keywords: ['яйца', 'яйцо', 'омлет', 'яичница'],
    caloriesPer100g: 157,
    proteinPer100g: 12.7,
    fatsPer100g: 11.5,
    carbsPer100g: 0.7,
  },
  {
    id: 'cottage-cheese-5',
    name: 'Творог 5%',
    keywords: ['творог 5%', 'творог'],
    caloriesPer100g: 121,
    proteinPer100g: 17.2,
    fatsPer100g: 5.0,
    carbsPer100g: 1.8,
  },
  {
    id: 'oats-dry',
    name: 'Овсяные хлопья (сухие)',
    keywords: ['овсянка', 'овсяные хлопья', 'геркулес'],
    caloriesPer100g: 366,
    proteinPer100g: 11.9,
    fatsPer100g: 7.2,
    carbsPer100g: 69.3,
  },
  {
    id: 'buckwheat-cooked',
    name: 'Гречка отварная',
    keywords: ['гречка вареная', 'гречка отварная', 'гречка', 'греча'],
    caloriesPer100g: 110,
    proteinPer100g: 4.2,
    fatsPer100g: 1.1,
    carbsPer100g: 21.3,
  },
  {
    id: 'rice-cooked',
    name: 'Рис отварной',
    keywords: ['рис вареный', 'рис отварной', 'рис'],
    caloriesPer100g: 130,
    proteinPer100g: 2.7,
    fatsPer100g: 0.3,
    carbsPer100g: 28.2,
  },
  {
    id: 'pasta-cooked',
    name: 'Макароны отварные',
    keywords: ['макароны', 'паста', 'спагетти'],
    caloriesPer100g: 131,
    proteinPer100g: 5.0,
    fatsPer100g: 1.1,
    carbsPer100g: 25.0,
  },
  {
    id: 'banana',
    name: 'Банан',
    keywords: ['банан', 'бананы'],
    caloriesPer100g: 89,
    proteinPer100g: 1.1,
    fatsPer100g: 0.3,
    carbsPer100g: 22.8,
  },
  {
    id: 'apple',
    name: 'Яблоко',
    keywords: ['яблоко', 'яблоки'],
    caloriesPer100g: 52,
    proteinPer100g: 0.3,
    fatsPer100g: 0.2,
    carbsPer100g: 13.8,
  },
  {
    id: 'avocado',
    name: 'Авокадо',
    keywords: ['авокадо'],
    caloriesPer100g: 160,
    proteinPer100g: 2.0,
    fatsPer100g: 14.7,
    carbsPer100g: 8.5,
  },
  {
    id: 'olive-oil',
    name: 'Оливковое масло',
    keywords: ['оливковое масло', 'масло оливковое', 'масло'],
    caloriesPer100g: 884,
    proteinPer100g: 0,
    fatsPer100g: 100.0,
    carbsPer100g: 0,
  },
  {
    id: 'whey-protein',
    name: 'Сывороточный протеин',
    keywords: ['протеин', 'сывороточный протеин', 'изолят'],
    caloriesPer100g: 390,
    proteinPer100g: 78.0,
    fatsPer100g: 5.5,
    carbsPer100g: 7.0,
  },
  {
    id: 'dates',
    name: 'Финики',
    keywords: ['финики', 'финик'],
    caloriesPer100g: 282,
    proteinPer100g: 2.5,
    fatsPer100g: 0.4,
    carbsPer100g: 75.0,
  },
];

// Чистая функция-калькулятор КБЖУ порции от веса в граммах
export function calculatePortionMacros(
  weightGrams: number,
  per100g: {
    caloriesPer100g: number;
    proteinPer100g: number;
    fatsPer100g: number;
    carbsPer100g: number;
  }
): CalculatedMacros {
  const safeWeight = Number.isFinite(weightGrams) && weightGrams > 0 ? weightGrams : 0;
  const factor = safeWeight / 100;

  return {
    calories: Math.round(per100g.caloriesPer100g * factor * 10) / 10,
    protein: Math.round(per100g.proteinPer100g * factor * 10) / 10,
    fats: Math.round(per100g.fatsPer100g * factor * 10) / 10,
    carbs: Math.round(per100g.carbsPer100g * factor * 10) / 10,
  };
}

// Поиск продукта в каталоге по названию или ключевому слову
export function findFoodInCatalog(
  query: string,
  catalog: FoodReference[] = DEFAULT_FOOD_CATALOG
): FoodReference | null {
  const normalized = query.trim().toLowerCase().replace(/ё/g, 'е');
  if (!normalized) return null;

  // Сначала проверяем точное вхождение длинных ключевых фраз, затем частичное
  for (const item of catalog) {
    for (const kw of item.keywords) {
      const normKw = kw.toLowerCase().replace(/ё/g, 'е');
      if (normalized === normKw || normalized.includes(normKw)) {
        return item;
      }
    }
  }
  return null;
}

/**
 * Парсер строки быстрого описания рациона.
 * Пример входа: "Куриная грудка 200г, гречка 180 г, авокадо 60"
 */
export function parseMealDescription(
  rawText: string,
  catalog: FoodReference[] = DEFAULT_FOOD_CATALOG
): ParsedMealItem[] {
  const chunks = rawText
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const results: ParsedMealItem[] = [];

  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx];
    // Извлекаем граммовку в конце или середине фразы: "200г", "200 г", "200гр", "200 мл", "200"
    const weightMatch = chunk.match(/(\d+(?:[.,]\d+)?)\s*(?:г|гр|грамм|мл)?\s*$/i);
    const weightGrams = weightMatch
      ? Math.max(1, parseFloat(weightMatch[1].replace(',', '.')))
      : 100;

    const cleanName = (
      weightMatch ? chunk.slice(0, weightMatch.index).trim() : chunk
    ).replace(/[-–—:]+$/, '').trim();

    if (!cleanName) continue;

    const matched = findFoodInCatalog(cleanName, catalog);

    results.push({
      id: `meal-item-${idx}-${cleanName.toLowerCase().replace(/\s+/g, '-')}`,
      productName: matched ? matched.name : cleanName,
      weightGrams,
      caloriesPer100g: matched ? matched.caloriesPer100g : 120,
      proteinPer100g: matched ? matched.proteinPer100g : 5,
      fatsPer100g: matched ? matched.fatsPer100g : 4,
      carbsPer100g: matched ? matched.carbsPer100g : 15,
      matchedFromCatalog: Boolean(matched),
    });
  }

  return results;
}
