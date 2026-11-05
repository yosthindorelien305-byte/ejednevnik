export type WorkoutSplitKey = 'all' | 'push' | 'pull' | 'legs' | 'core';

export interface PresetExercise {
  name: string;
  sets: Array<{ weight: number; reps: number }>;
  includeBodyweight?: boolean;
}

export interface WorkoutSplitPreset {
  key: WorkoutSplitKey;
  label: string;
  title: string;
  subtitle: string;
  targetMuscles: string[];
  estimatedMinutes: number;
  estimatedCalories: number;
  exercises: PresetExercise[];
  muscleFocus: Array<{ muscle: string; percentage: number; color: string }>;
}

export const WORKOUT_SPLIT_PRESETS: Record<WorkoutSplitKey, WorkoutSplitPreset> = {
  all: {
    key: 'all',
    label: 'Все',
    title: 'Full Body · Фулбоди сплит',
    subtitle: 'Комплексная проработка всех основных мышечных групп',
    targetMuscles: ['Грудь', 'Спина', 'Ноги', 'Плечи', 'Руки', 'Пресс'],
    estimatedMinutes: 55,
    estimatedCalories: 420,
    exercises: [
      {
        name: 'Жим штанги лежа',
        sets: [
          { weight: 80, reps: 10 },
          { weight: 80, reps: 8 },
          { weight: 80, reps: 8 },
        ],
        includeBodyweight: false,
      },
      {
        name: 'Подтягивания широким хватом',
        sets: [
          { weight: 0, reps: 10 },
          { weight: 0, reps: 8 },
          { weight: 0, reps: 8 },
        ],
        includeBodyweight: true,
      },
      {
        name: 'Приседания со штангой',
        sets: [
          { weight: 85, reps: 10 },
          { weight: 85, reps: 10 },
          { weight: 85, reps: 8 },
        ],
        includeBodyweight: false,
      },
      {
        name: 'Армейский жим стоя',
        sets: [
          { weight: 50, reps: 10 },
          { weight: 50, reps: 8 },
        ],
        includeBodyweight: false,
      },
    ],
    muscleFocus: [
      { muscle: 'Грудь', percentage: 25, color: '#C4F124' },
      { muscle: 'Спина', percentage: 25, color: '#FF6D3B' },
      { muscle: 'Ноги', percentage: 30, color: '#8A4FFF' },
      { muscle: 'Плечи и руки', percentage: 20, color: '#00D2FF' },
    ],
  },
  push: {
    key: 'push',
    label: 'Push',
    title: 'Push Day · Жимовой день',
    subtitle: 'Chest • Shoulders • Triceps',
    targetMuscles: ['Грудь', 'Передние дельты', 'Средние дельты', 'Трицепс'],
    estimatedMinutes: 45,
    estimatedCalories: 320,
    exercises: [
      {
        name: 'Жим штанги лежа (Barbell Bench Press)',
        sets: [
          { weight: 80, reps: 10 },
          { weight: 85, reps: 8 },
          { weight: 85, reps: 8 },
          { weight: 80, reps: 10 },
        ],
        includeBodyweight: false,
      },
      {
        name: 'Жим гантелей на наклонной скамье (Incline Dumbbell Press)',
        sets: [
          { weight: 28, reps: 10 },
          { weight: 30, reps: 8 },
          { weight: 28, reps: 10 },
        ],
        includeBodyweight: false,
      },
      {
        name: 'Жим гантелей сидя на плечи (Shoulder Press)',
        sets: [
          { weight: 22, reps: 10 },
          { weight: 24, reps: 10 },
          { weight: 22, reps: 10 },
        ],
        includeBodyweight: false,
      },
      {
        name: 'Разгибания на трицепс на блоке (Tricep Pushdown)',
        sets: [
          { weight: 30, reps: 12 },
          { weight: 35, reps: 12 },
          { weight: 35, reps: 10 },
        ],
        includeBodyweight: false,
      },
    ],
    muscleFocus: [
      { muscle: 'Грудь', percentage: 50, color: '#C4F124' },
      { muscle: 'Плечи', percentage: 30, color: '#FF6D3B' },
      { muscle: 'Трицепс', percentage: 20, color: '#8A4FFF' },
    ],
  },
  pull: {
    key: 'pull',
    label: 'Pull',
    title: 'Pull Day · День тяги',
    subtitle: 'Back • Rear Delts • Biceps',
    targetMuscles: ['Широчайшие спины', 'Трапеции', 'Задние дельты', 'Бицепс'],
    estimatedMinutes: 45,
    estimatedCalories: 340,
    exercises: [
      {
        name: 'Подтягивания широким хватом (Pull-Ups)',
        sets: [
          { weight: 0, reps: 10 },
          { weight: 0, reps: 9 },
          { weight: 0, reps: 8 },
          { weight: 0, reps: 8 },
        ],
        includeBodyweight: true,
      },
      {
        name: 'Тяга штанги в наклоне (Barbell Row)',
        sets: [
          { weight: 70, reps: 10 },
          { weight: 75, reps: 8 },
          { weight: 75, reps: 8 },
          { weight: 70, reps: 10 },
        ],
        includeBodyweight: false,
      },
      {
        name: 'Тяга верхнего блока к груди (Lat Pulldown)',
        sets: [
          { weight: 55, reps: 12 },
          { weight: 60, reps: 10 },
          { weight: 60, reps: 10 },
        ],
        includeBodyweight: false,
      },
      {
        name: 'Подъем штанги на бицепс (Barbell Bicep Curl)',
        sets: [
          { weight: 30, reps: 12 },
          { weight: 35, reps: 10 },
          { weight: 35, reps: 10 },
        ],
        includeBodyweight: false,
      },
    ],
    muscleFocus: [
      { muscle: 'Широчайшие', percentage: 45, color: '#C4F124' },
      { muscle: 'Трапеции и задняя дельта', percentage: 25, color: '#FF6D3B' },
      { muscle: 'Бицепс', percentage: 30, color: '#00D2FF' },
    ],
  },
  legs: {
    key: 'legs',
    label: 'Legs',
    title: 'Legs Day · День ног',
    subtitle: 'Quads • Hamstrings • Glutes • Calves',
    targetMuscles: ['Квадрицепс', 'Бицепс бедра', 'Ягодичные', 'Икры'],
    estimatedMinutes: 50,
    estimatedCalories: 380,
    exercises: [
      {
        name: 'Приседания со штангой на плечах (Barbell Back Squat)',
        sets: [
          { weight: 90, reps: 10 },
          { weight: 100, reps: 8 },
          { weight: 100, reps: 8 },
          { weight: 90, reps: 10 },
        ],
        includeBodyweight: false,
      },
      {
        name: 'Румынская тяга (Romanian Deadlift)',
        sets: [
          { weight: 80, reps: 10 },
          { weight: 85, reps: 10 },
          { weight: 85, reps: 8 },
        ],
        includeBodyweight: false,
      },
      {
        name: 'Жим ногами в тренажере (Leg Press)',
        sets: [
          { weight: 140, reps: 12 },
          { weight: 160, reps: 10 },
          { weight: 160, reps: 10 },
        ],
        includeBodyweight: false,
      },
      {
        name: 'Подъемы на носки стоя (Calf Raises)',
        sets: [
          { weight: 50, reps: 15 },
          { weight: 55, reps: 15 },
          { weight: 55, reps: 15 },
        ],
        includeBodyweight: false,
      },
    ],
    muscleFocus: [
      { muscle: 'Квадрицепсы', percentage: 40, color: '#C4F124' },
      { muscle: 'Бицепс бедра и ягодицы', percentage: 40, color: '#FF6D3B' },
      { muscle: 'Икры', percentage: 20, color: '#8A4FFF' },
    ],
  },
  core: {
    key: 'core',
    label: 'Core',
    title: 'Core & Abs · Пресс и кор',
    subtitle: 'Upper Abs • Lower Abs • Obliques',
    targetMuscles: ['Прямая мышца живота', 'Косые мышцы', 'Поясница'],
    estimatedMinutes: 30,
    estimatedCalories: 210,
    exercises: [
      {
        name: 'Подъем ног в висе на перекладине (Hanging Leg Raise)',
        sets: [
          { weight: 0, reps: 12 },
          { weight: 0, reps: 12 },
          { weight: 0, reps: 10 },
          { weight: 0, reps: 10 },
        ],
        includeBodyweight: true,
      },
      {
        name: 'Скручивания на наклонной скамье (Decline Crunch)',
        sets: [
          { weight: 10, reps: 15 },
          { weight: 10, reps: 15 },
          { weight: 10, reps: 12 },
        ],
        includeBodyweight: true,
      },
      {
        name: 'Планка с блином на спине (Weighted Plank)',
        sets: [
          { weight: 15, reps: 60 },
          { weight: 15, reps: 60 },
          { weight: 20, reps: 45 },
        ],
        includeBodyweight: true,
      },
    ],
    muscleFocus: [
      { muscle: 'Прямая мышца (пресс)', percentage: 55, color: '#C4F124' },
      { muscle: 'Косые мышцы', percentage: 30, color: '#FF6D3B' },
      { muscle: 'Поясничный отдел', percentage: 15, color: '#00D2FF' },
    ],
  },
};
