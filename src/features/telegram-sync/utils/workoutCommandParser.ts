// Утилиты разбора быстрых текстовых команд Telegram-бота

export interface ParsedTelegramExercise {
  exerciseName: string;
  workingWeight: number;
  setsCount: number;
  repsCount: number;
  tonnage: number;
}

/**
 * Разбирает аргумент команды /workout.
 * Поддерживаемые форматы:
 * 1) "Жим 80x4, Присед 100x4" -> вес 80 кг, 1 подход x 4 повторения (или быстрый сет)
 * 2) "Жим лежа 80x4x10, Тяга 70x3x12" -> вес 80 кг, 4 подхода x 10 повторений
 * Поддерживаются разделители: x, X, кириллическая х, Х, *.
 */
export function parseWorkoutCommand(rawText: string): ParsedTelegramExercise[] {
  const segments = rawText
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const exercises: ParsedTelegramExercise[] = [];

  // Регулярное выражение ищет в конце сегмента схему "Вес x Повторы" или "Вес x Подходы x Повторы"
  const schemeRegex =
    /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*[xXхХ*]\s*(\d+)(?:\s*[xXхХ*]\s*(\d+))?\s*$/;

  for (const segment of segments) {
    const match = segment.match(schemeRegex);
    if (!match) continue;

    const exerciseName = match[1].trim();
    const workingWeight = parseFloat(match[2].replace(',', '.'));
    const numA = parseInt(match[3], 10);
    const numB = match[4] ? parseInt(match[4], 10) : null;

    if (!exerciseName || Number.isNaN(workingWeight) || Number.isNaN(numA)) {
      continue;
    }

    // Если передано 3 числа (80x4x10) -> 4 подхода по 10 повторений;
    // если 2 числа (80x4) -> 1 рабочий блок на 4 повторения (или 4 подхода с весом 80 — фиксируем 1x4, тоннаж = 320 кг)
    const setsCount = numB !== null ? Math.max(1, numA) : 1;
    const repsCount = numB !== null ? Math.max(1, numB) : Math.max(1, numA);
    const tonnage = Math.round(workingWeight * setsCount * repsCount * 100) / 100;

    exercises.push({
      exerciseName,
      workingWeight,
      setsCount,
      repsCount,
      tonnage,
    });
  }

  return exercises;
}

/**
 * Возвращает текущую дату в формате YYYY-MM-DD в часовом поясе пользователя
 */
export function getTodayInTimezone(timezone = 'Europe/Moscow'): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Формирует текстовый прогресс-бар для сообщений в Telegram
 */
export function renderTextProgressBar(current: number, goal: number, size = 10): string {
  const safeGoal = goal > 0 ? goal : 1;
  const ratio = Math.min(1, Math.max(0, current / safeGoal));
  const filled = Math.round(ratio * size);
  return '🟩'.repeat(filled) + '⬜'.repeat(size - filled);
}
