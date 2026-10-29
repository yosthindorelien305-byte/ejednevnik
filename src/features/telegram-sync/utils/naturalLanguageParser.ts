import {
  parseWorkoutCommand,
  type ParsedTelegramExercise,
} from '@/features/telegram-sync/utils/workoutCommandParser';
import {
  parseMealDescription,
  calculatePortionMacros,
} from '@/features/nutrition/utils/macroParser';

// Точное количество аятов во всех 114 сурах Священного Корана (индекс = номер суры - 1)
export const SURAH_AYAH_COUNTS: readonly number[] = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128,
  111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54,
  45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62,
  55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28,
  20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15,
  21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

// Структурированный результат распознавания сообщения пользователя (Discriminated Union)
export type NaturalMessageIntent =
  | {
      kind: 'status_query';
    }
  | {
      kind: 'quran_progress';
      title: string;
      surahNumber: number | null;
      ayahPosition: number;
      totalTarget: number;
    }
  | {
      kind: 'book_progress';
      title: string;
      position: number;
      isRelativeDelta: boolean;
      explicitTotalPages: number | null;
    }
  | {
      kind: 'useful_link';
      url: string;
      comment: string;
      category: 'book' | 'quran' | 'nutrition' | 'vibecoding' | 'general';
    }
  | {
      kind: 'workout_entry';
      exercises: ParsedTelegramExercise[];
    }
  | {
      kind: 'nutrition_entry';
      mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
      description: string;
      calories: number;
      protein: number;
      fats: number;
      carbs: number;
    }
  | {
      kind: 'unknown';
    };

function cleanQuotes(raw: string): string {
  return raw
    .trim()
    .replace(/^[«"'„“]+|[»"'”.,;!?]+$/g, '')
    .trim();
}

/**
 * Детерминированный парсер сообщений на естественном русском языке.
 * Распознает чтение книг, Корана, ссылки с комментариями, тренировки, питание и вопросы о прогрессе.
 */
export function parseNaturalLanguageMessage(rawText: string): NaturalMessageIntent {
  const text = rawText.trim();
  if (!text) return { kind: 'unknown' };

  // 1. Вопрос о текущем прогрессе («Где я остановился?», «Мой прогресс», «Статус»)
  if (
    /^(?:где\s+я\s+остановил(?:ся|ась)|на\s+ч[её]м\s+(?:я\s+)?остановил(?:ся|ась)|(?:мой|какой)\s+прогресс|статус|сводка(?:\s+за\s+сегодня)?)[?!.\s]*$/i.test(
      text
    )
  ) {
    return { kind: 'status_query' };
  }

  // 2. Ссылка с комментарием (https://...)
  const urlMatch = text.match(/https?:\/\/[^\s<>"]+/i);
  if (urlMatch) {
    const url = urlMatch[0].replace(/[.,;!?)]+$/, '');
    const comment = text
      .replace(urlMatch[0], '')
      .replace(/^[\s—–:-]+|[\s—–:-]+$/g, '')
      .trim();

    let category: 'book' | 'quran' | 'nutrition' | 'vibecoding' | 'general' =
      'general';
    if (/(коран|сура|аят|тафсир)/i.test(comment)) category = 'quran';
    else if (/(книг|глава|конспект|чтени)/i.test(comment)) category = 'book';
    else if (/(рецепт|питани|блюдо|кбжу|калори)/i.test(comment))
      category = 'nutrition';
    else if (/(код|вайбкод|промпт|react|next|supabase|github|api)/i.test(comment))
      category = 'vibecoding';

    return {
      kind: 'useful_link',
      url,
      comment,
      category,
    };
  }

  // 3. Обработка чтения Корана
  // Примеры: «Коран 2 сура 15 аят», «Сура 2, аят 15», «Коран 2:15», «Сура Аль-Кахф 10 аят»
  if (/(?:коран|сур[аеыу]|аят)/i.test(text)) {
    // 3.1 Формат с номером суры и номером аята
    const surahNumMatch =
      text.match(/(\d{1,3})\s*-?(?:я|ую|й)?\s*сур[аеыу](?=$|[\s,.;:!?])/i) ||
      text.match(/сур[аеыу]\s*№?\s*(\d{1,3})(?=\D|$)/i);
    const ayahNumMatch =
      text.match(/(\d{1,3})\s*-?(?:й|ом|го)?\s*аят[ауе]?(?=$|[\s,.;:!?])/i) ||
      text.match(/аят[ауе]?\s*№?\s*(\d{1,3})(?=\D|$)/i);

    if (surahNumMatch && ayahNumMatch) {
      const surahNumber = Math.min(
        114,
        Math.max(1, parseInt(surahNumMatch[1], 10))
      );
      const totalTarget = SURAH_AYAH_COUNTS[surahNumber - 1] ?? 286;
      const ayahPosition = Math.min(
        totalTarget,
        Math.max(1, parseInt(ayahNumMatch[1], 10))
      );

      return {
        kind: 'quran_progress',
        title: `Сура ${surahNumber}`,
        surahNumber,
        ayahPosition,
        totalTarget,
      };
    }

    // 3.2 Короткая запись «Коран 2:15» или «Сура 18:25»
    const colonMatch = text.match(
      /(?:коран|сура)\s*(\d{1,3})\s*[:.]\s*(\d{1,3})(?=\D|$)/i
    );
    if (colonMatch) {
      const surahNumber = Math.min(
        114,
        Math.max(1, parseInt(colonMatch[1], 10))
      );
      const totalTarget = SURAH_AYAH_COUNTS[surahNumber - 1] ?? 286;
      const ayahPosition = Math.min(
        totalTarget,
        Math.max(1, parseInt(colonMatch[2], 10))
      );

      return {
        kind: 'quran_progress',
        title: `Сура ${surahNumber}`,
        surahNumber,
        ayahPosition,
        totalTarget,
      };
    }

    // 3.3 Словесное название суры: «Коран сура Аль-Мульк 12 аят»
    const namedSurahMatch = text.match(
      /сур[аеыу]\s+([а-яёa-z-\s]+?)[,\s]+(?:(\d{1,3})\s*аят|аят[ауе]?\s*(\d{1,3}))/i
    );
    if (namedSurahMatch) {
      const surahTitle = cleanQuotes(namedSurahMatch[1]);
      const ayahPosition = Math.max(
        1,
        parseInt(namedSurahMatch[2] || namedSurahMatch[3], 10)
      );
      return {
        kind: 'quran_progress',
        title: `Сура ${surahTitle}`,
        surahNumber: null,
        ayahPosition,
        totalTarget: Math.max(ayahPosition, 286),
      };
    }
  }

  // 4. Обработка чтения книг
  // 4.1 «Прочитал 45 страниц книги Атомные привычки» / «Прочитал до 45 страницы книги "Чистый код" из 464»
  const bookFirstNumPattern =
    /^(?:прочитал[аи]?|читал[аи]?|остановил(?:ся|ась)\s+на)\s+(?:до\s+)?(\+?\d+)\s*(?:стр(?:аниц[аеыу]?|\.)?)\s+(?:книг[иеу]\s+)?(.+?)(?:\s+из\s+(\d+))?[.\s]*$/i;
  const mBook1 = text.match(bookFirstNumPattern);
  if (mBook1) {
    const rawNum = mBook1[1];
    const title = cleanQuotes(mBook1[2]);
    const explicitTotal = mBook1[3] ? parseInt(mBook1[3], 10) : null;
    if (title) {
      return {
        kind: 'book_progress',
        title,
        position: Math.max(1, parseInt(rawNum.replace('+', ''), 10)),
        isRelativeDelta: rawNum.startsWith('+'),
        explicitTotalPages: explicitTotal,
      };
    }
  }

  // 4.2 «Книга Атомные привычки 45 стр» / «Книга "Атомные привычки": страница 45 из 300»
  const bookTitleFirstPattern =
    /^(?:книга\s+)(.+?)[\s:—,-]+(?:на\s+|до\s+)?(?:стр(?:аниц[аеыу]?|\.)?\s*)?(\+?\d+)(?:\s*стр(?:аниц[аеыу]?|\.)?)?(?:\s+из\s+(\d+))?[.\s]*$/i;
  const mBook2 = text.match(bookTitleFirstPattern);
  if (mBook2) {
    const title = cleanQuotes(mBook2[1]);
    const rawNum = mBook2[2];
    const explicitTotal = mBook2[3] ? parseInt(mBook2[3], 10) : null;
    if (title) {
      return {
        kind: 'book_progress',
        title,
        position: Math.max(1, parseInt(rawNum.replace('+', ''), 10)),
        isRelativeDelta: rawNum.startsWith('+'),
        explicitTotalPages: explicitTotal,
      };
    }
  }

  // 4.3 «Прочитал книгу Атомные привычки до 45 страницы»
  const bookTitleMiddlePattern =
    /^(?:прочитал[аи]?|читал[аи]?)\s+(?:книгу\s+)?(.+?)\s+(?:до\s+|на\s+)(\+?\d+)\s*(?:стр(?:аниц[аеыу]?|\.)?)(?:\s+из\s+(\d+))?[.\s]*$/i;
  const mBook3 = text.match(bookTitleMiddlePattern);
  if (mBook3) {
    const title = cleanQuotes(mBook3[1]);
    const rawNum = mBook3[2];
    const explicitTotal = mBook3[3] ? parseInt(mBook3[3], 10) : null;
    if (title) {
      return {
        kind: 'book_progress',
        title,
        position: Math.max(1, parseInt(rawNum.replace('+', ''), 10)),
        isRelativeDelta: rawNum.startsWith('+'),
        explicitTotalPages: explicitTotal,
      };
    }
  }

  // 5. Естественная запись питания («Обед: куриная грудка 200г, гречка 180г» или «Съел творог 1850 ккал»)
  const mealPrefixMatch = text.match(
    /^(завтрак|обед|ужин|перекус|питание|съел[аи]?|поел[аи]?)[\s:,-]+(.+)$/i
  );
  if (mealPrefixMatch) {
    const rawKind = mealPrefixMatch[1].toLowerCase();
    const body = mealPrefixMatch[2].trim();

    let mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'lunch';
    if (rawKind === 'завтрак') mealType = 'breakfast';
    else if (rawKind === 'ужин') mealType = 'dinner';
    else if (rawKind === 'перекус') mealType = 'snack';

    // Если явно указаны ккал в строке: например «Питание: рацион 1850 ккал»
    const explicitKcalMatch = body.match(/(\d+(?:[.,]\d+)?)\s*ккал/i);
    if (explicitKcalMatch) {
      const calories = parseFloat(explicitKcalMatch[1].replace(',', '.'));
      return {
        kind: 'nutrition_entry',
        mealType,
        description: body,
        calories,
        protein: 0,
        fats: 0,
        carbs: 0,
      };
    }

    const parsedItems = parseMealDescription(body);
    if (parsedItems.length > 0) {
      const totals = parsedItems.reduce(
        (acc, item) => {
          const m = calculatePortionMacros(item.weightGrams, item);
          return {
            calories: Math.round((acc.calories + m.calories) * 10) / 10,
            protein: Math.round((acc.protein + m.protein) * 10) / 10,
            fats: Math.round((acc.fats + m.fats) * 10) / 10,
            carbs: Math.round((acc.carbs + m.carbs) * 10) / 10,
          };
        },
        { calories: 0, protein: 0, fats: 0, carbs: 0 }
      );

      return {
        kind: 'nutrition_entry',
        mealType,
        description: body,
        ...totals,
      };
    }
  }

  // 6. Естественная запись тренировки без слэша
  // 6.1 Разговорная фраза («Сделал 4 подхода жима», «4 подхода жима по 10 раз 80 кг»)
  const naturalSetsMatch = text.match(
    /^(?:сделал[аи]?\s+|записал[аи]?\s+|тренировка[\s:,-]+)?(\d+)\s*подход(?:а|ов)?\s+([а-яёa-z\s-]+?)(?:\s+(?:по\s+|на\s+)?(\d+)\s*(?:повт[а-яё]*|раз[а]?))?(?:\s+(?:по\s+|весом\s+|с\s+весом\s+)?(\d+(?:[.,]\d+)?)\s*кг)?[.\s]*$/i
  );
  if (naturalSetsMatch) {
    const setsCount = Math.max(1, parseInt(naturalSetsMatch[1], 10));
    const exerciseName = naturalSetsMatch[2].trim();
    const repsCount = naturalSetsMatch[3]
      ? Math.max(1, parseInt(naturalSetsMatch[3], 10))
      : 10;
    const workingWeight = naturalSetsMatch[4]
      ? parseFloat(naturalSetsMatch[4].replace(',', '.'))
      : 0;
    const tonnage =
      Math.round(workingWeight * setsCount * repsCount * 100) / 100;

    if (exerciseName) {
      return {
        kind: 'workout_entry',
        exercises: [
          {
            exerciseName,
            workingWeight,
            setsCount,
            repsCount,
            tonnage,
          },
        ],
      };
    }
  }

  // 6.2 Схема подходов («Тренировка: Жим 80x4, Присед 100x4» или просто «Жим 80x4x10»)
  const workoutBody = text.replace(/^тренировка[\s:,-]+/i, '').trim();
  const exercises = parseWorkoutCommand(workoutBody);
  if (exercises.length > 0) {
    return {
      kind: 'workout_entry',
      exercises,
    };
  }

  return { kind: 'unknown' };
}
