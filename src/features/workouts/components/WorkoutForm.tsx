'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  Camera,
  Dumbbell,
  Flame,
  Copy,
  CheckCircle2,
  X,
  HeartPulse,
  AlertCircle,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// Типы тренировки в соответствии с ENUM workout_type в Supabase
export type WorkoutType =
  | 'strength'
  | 'calisthenics'
  | 'cardio'
  | 'hiit'
  | 'stretching'
  | 'other';

export interface ExerciseSetItem {
  id: string;
  weight: number; // Рабочий вес в кг
  reps: number;   // Количество повторений
}

export interface ExerciseFormItem {
  id: string;
  name: string;
  sets: ExerciseSetItem[];
}

export interface ProgressPhotoPreview {
  id: string;
  file: File;
  previewUrl: string;
  caption: string;
}

export interface WorkoutSubmitPayload {
  workoutDate: string;
  workoutType: WorkoutType;
  title: string;
  wellbeingRating: number;
  wellbeingNotes: string;
  bodyWeight: number | null;
  totalTonnage: number;
  exercises: Array<{
    exerciseName: string;
    setsCount: number;
    repsCount: number;
    workingWeight: number;
    exerciseTonnage: number;
    setsDetail: Array<{ set: number; weight: number; reps: number }>;
  }>;
  photos: Array<{ file: File; caption: string }>;
}

interface WorkoutFormProps {
  onSubmitWorkout?: (payload: WorkoutSubmitPayload) => Promise<void> | void;
}

const WORKOUT_TYPE_LABELS: Record<WorkoutType, string> = {
  strength: 'Силовая',
  calisthenics: 'Воркаут / Свой вес',
  cardio: 'Кардио',
  hiit: 'HIIT / Функциональная',
  stretching: 'Растяжка / Мобилити',
  other: 'Другое',
};

// Генератор локальных идентификаторов для динамических списков формы
const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 11);

export function WorkoutForm({ onSubmitWorkout }: WorkoutFormProps) {
  const [workoutDate, setWorkoutDate] = useState<string>('');
  const [workoutType, setWorkoutType] = useState<WorkoutType>('strength');
  const [title, setTitle] = useState<string>('');
  const [wellbeingRating, setWellbeingRating] = useState<number>(8);
  const [wellbeingNotes, setWellbeingNotes] = useState<string>('');
  const [bodyWeight, setBodyWeight] = useState<string>('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Динамический список упражнений и подходов с детерминированными стартовыми ID (без расхождений SSR)
  const [exercises, setExercises] = useState<ExerciseFormItem[]>([
    {
      id: 'ex-init-1',
      name: 'Жим штанги лежа',
      sets: [
        { id: 'set-init-1', weight: 60, reps: 10 },
        { id: 'set-init-2', weight: 70, reps: 8 },
      ],
    },
  ]);

  // Устанавливаем текущую локальную дату на клиенте после гидратации
  useEffect(() => {
    setWorkoutDate(new Intl.DateTimeFormat('en-CA').format(new Date()));
  }, []);

  // Загруженные фото прогресса с локальными Object URL для предпросмотра
  const [photos, setPhotos] = useState<ProgressPhotoPreview[]>([]);
  const photosRef = useRef<ProgressPhotoPreview[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [savedBanner, setSavedBanner] = useState<boolean>(false);

  // Держим актуальную ссылку на массив превью для очистки памяти при размонтировании
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, []);

  // Расчет тоннажа по каждому упражнению и общего тоннажа всей тренировки
  const stats = useMemo(() => {
    let totalTonnage = 0;
    let totalSets = 0;
    const perExerciseTonnage: Record<string, number> = {};

    for (const exercise of exercises) {
      let exerciseSum = 0;
      for (const s of exercise.sets) {
        const validWeight = Number.isFinite(s.weight) && s.weight > 0 ? s.weight : 0;
        const validReps = Number.isFinite(s.reps) && s.reps > 0 ? s.reps : 0;
        exerciseSum += validWeight * validReps;
        totalSets += 1;
      }
      exerciseSum = Math.round(exerciseSum * 100) / 100;
      perExerciseTonnage[exercise.id] = exerciseSum;
      totalTonnage += exerciseSum;
    }

    return {
      totalTonnage: Math.round(totalTonnage * 100) / 100,
      totalSets,
      perExerciseTonnage,
    };
  }, [exercises]);

  // Добавление нового упражнения
  const addExercise = () => {
    setExercises((prev) => [
      ...prev,
      {
        id: createId(),
        name: '',
        sets: [{ id: createId(), weight: 20, reps: 10 }],
      },
    ]);
  };

  // Удаление упражнения
  const removeExercise = (exerciseId: string) => {
    setExercises((prev) => prev.filter((ex) => ex.id !== exerciseId));
  };

  // Изменение названия упражнения
  const updateExerciseName = (exerciseId: string, name: string) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === exerciseId ? { ...ex, name } : ex))
    );
  };

  // Динамическое добавление подхода (копирует вес и повторения предыдущего подхода)
  const addSet = (exerciseId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        const lastSet = ex.sets[ex.sets.length - 1];
        const nextSet: ExerciseSetItem = {
          id: createId(),
          weight: lastSet ? lastSet.weight : 20,
          reps: lastSet ? lastSet.reps : 10,
        };
        return { ...ex, sets: [...ex.sets, nextSet] };
      })
    );
  };

  // Обновление веса или повторений в конкретном подходе
  const updateSet = (
    exerciseId: string,
    setId: string,
    field: 'weight' | 'reps',
    rawValue: string
  ) => {
    const parsed = rawValue === '' ? 0 : Number(rawValue);
    const safeValue = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;

    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s) =>
            s.id === setId ? { ...s, [field]: safeValue } : s
          ),
        };
      })
    );
  };

  // Удаление подхода
  const removeSet = (exerciseId: string, setId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId || ex.sets.length <= 1) return ex;
        return { ...ex, sets: ex.sets.filter((s) => s.id !== setId) };
      })
    );
  };

  // Обработка выбора фото формы с генерацией локального превью
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const addedPhotos: ProgressPhotoPreview[] = Array.from(fileList).map(
      (file) => ({
        id: createId(),
        file,
        previewUrl: URL.createObjectURL(file),
        caption: '',
      })
    );

    setPhotos((prev) => [...prev, ...addedPhotos]);
    e.target.value = '';
  };

  // Удаление фото прогресса и освобождение Object URL
  const removePhoto = (photoId: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === photoId);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((p) => p.id !== photoId);
    });
  };

  const updatePhotoCaption = (photoId: string, caption: string) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, caption } : p))
    );
  };

  // Формирование итогового пакета данных (готового к записи в Supabase)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSavedBanner(false);

    try {
      const payload: WorkoutSubmitPayload = {
        workoutDate,
        workoutType,
        title: title.trim() || WORKOUT_TYPE_LABELS[workoutType],
        wellbeingRating,
        wellbeingNotes: wellbeingNotes.trim(),
        bodyWeight: bodyWeight ? Number(bodyWeight) : null,
        totalTonnage: stats.totalTonnage,
        exercises: exercises
          .filter((ex) => ex.name.trim().length > 0 && ex.sets.length > 0)
          .map((ex) => {
            const setsCount = ex.sets.length;
            const maxWeight = Math.max(...ex.sets.map((s) => s.weight), 0);
            const avgReps = Math.max(
              1,
              Math.round(
                ex.sets.reduce((acc, s) => acc + s.reps, 0) / setsCount
              )
            );

            return {
              exerciseName: ex.name.trim(),
              setsCount,
              repsCount: avgReps,
              workingWeight: maxWeight,
              exerciseTonnage: stats.perExerciseTonnage[ex.id] ?? 0,
              setsDetail: ex.sets.map((s, idx) => ({
                set: idx + 1,
                weight: s.weight,
                reps: s.reps,
              })),
            };
          }),
        photos: photos.map((p) => ({
          file: p.file,
          caption: p.caption.trim(),
        })),
      };

      if (onSubmitWorkout) {
        await onSubmitWorkout(payload);
      } else {
        // Автоматическая запись в Supabase (workouts + workout_sets + workout-photos), если пользователь авторизован
        const supabase = getSupabaseBrowserClient();
        if (supabase) {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (user) {
            const uploadedPhotoRefs: string[] = [];
            const yearMonth = (
              payload.workoutDate || new Date().toISOString().slice(0, 10)
            ).slice(0, 7);

            for (const p of payload.photos) {
              const ext = (p.file.name.split('.').pop() || 'jpg')
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '');
              const storagePath = `${user.id}/${yearMonth}/${createId()}.${
                ext || 'jpg'
              }`;
              const { error: upErr } = await supabase.storage
                .from('workout-photos')
                .upload(storagePath, p.file, {
                  contentType: p.file.type || 'image/jpeg',
                  upsert: false,
                });
              if (!upErr) {
                uploadedPhotoRefs.push(`workout-photos/${storagePath}`);
              }
            }

            const combinedNotes = [
              payload.wellbeingNotes,
              payload.bodyWeight ? `Вес тела: ${payload.bodyWeight} кг` : '',
              `Самочувствие: ${payload.wellbeingRating}/10`,
            ]
              .filter(Boolean)
              .join(' · ');

            const { data: createdWorkout, error: wErr } = await supabase
              .from('workouts')
              .insert({
                user_id: user.id,
                workout_date:
                  payload.workoutDate ||
                  new Intl.DateTimeFormat('en-CA').format(new Date()),
                title: payload.title,
                notes: combinedNotes || null,
                photo_urls: uploadedPhotoRefs,
                last_updated_by: 'web',
              })
              .select('id')
              .single();

            if (wErr) throw new Error(wErr.message);

            if (createdWorkout && payload.exercises.length > 0) {
              const setsRows = payload.exercises.map((ex) => ({
                workout_id: createdWorkout.id,
                user_id: user.id,
                exercise_name: ex.exerciseName,
                sets_count: ex.setsCount,
                reps: ex.repsCount,
                weight_kg: ex.workingWeight,
              }));
              const { error: sErr } = await supabase
                .from('workout_sets')
                .insert(setsRows);
              if (sErr) throw new Error(sErr.message);
            }
          }
        }
      }

      setSubmitError(null);
      setSavedBanner(true);
      setTimeout(() => setSavedBanner(false), 3500);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Не удалось сохранить тренировку'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Виджет сводной статистики текущей тренировки */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-4 text-white shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium tracking-wide text-emerald-100 uppercase">
              Общий тоннаж тренировки
            </p>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-3xl font-bold tracking-tight">
                {stats.totalTonnage.toLocaleString('ru-RU')}
              </span>
              <span className="text-sm font-medium text-emerald-100">кг</span>
            </div>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
            <Flame className="h-6 w-6 text-amber-300" />
          </div>
        </div>

        <div className="mt-3 flex gap-4 border-t border-white/15 pt-3 text-xs text-emerald-50">
          <span>
            Упражнений: <strong>{exercises.length}</strong>
          </span>
          <span>
            Рабочих подходов: <strong>{stats.totalSets}</strong>
          </span>
          {photos.length > 0 && (
            <span>
              Фото формы: <strong>{photos.length}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Основные параметры тренировки */}
      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <Dumbbell className="h-4 w-4 text-emerald-500" />
          Параметры тренировки
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Дата
            </label>
            <input
              type="date"
              value={workoutDate}
              onChange={(e) => setWorkoutDate(e.target.value)}
              required
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Тип тренировки
            </label>
            <select
              value={workoutType}
              onChange={(e) => setWorkoutType(e.target.value as WorkoutType)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {(Object.keys(WORKOUT_TYPE_LABELS) as WorkoutType[]).map((key) => (
                <option key={key} value={key}>
                  {WORKOUT_TYPE_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Название / Сплит
          </label>
          <input
            type="text"
            placeholder="Например: Грудь + Трицепс или Тяжелый верх"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
      </section>

      {/* Динамический список упражнений и подходов */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Упражнения и подходы
          </h2>
          <button
            type="button"
            onClick={addExercise}
            className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/20 active:scale-95 dark:text-emerald-400"
          >
            <Plus className="h-3.5 w-3.5" />
            Упражнение
          </button>
        </div>

        {exercises.map((exercise, exIndex) => {
          const exTonnage = stats.perExerciseTonnage[exercise.id] ?? 0;

          return (
            <div
              key={exercise.id}
              className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {exIndex + 1}
                </span>
                <input
                  type="text"
                  required
                  placeholder="Название упражнения (Жим, Присед, Тяга...)"
                  value={exercise.name}
                  onChange={(e) =>
                    updateExerciseName(exercise.id, e.target.value)
                  }
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                {exercises.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeExercise(exercise.id)}
                    aria-label="Удалить упражнение"
                    className="rounded-xl p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Заголовки колонок таблицы подходов */}
              <div className="mt-3 grid grid-cols-12 items-center gap-2 px-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                <span className="col-span-2">Сет</span>
                <span className="col-span-4">Вес (кг)</span>
                <span className="col-span-3">Повторы</span>
                <span className="col-span-2 text-right">Тоннаж</span>
                <span className="col-span-1" />
              </div>

              {/* Строки подходов */}
              <div className="mt-1.5 space-y-2">
                {exercise.sets.map((setItem, setIdx) => {
                  const setVolume =
                    Math.round(setItem.weight * setItem.reps * 10) / 10;

                  return (
                    <div
                      key={setItem.id}
                      className="grid grid-cols-12 items-center gap-2"
                    >
                      <div className="col-span-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          #{setIdx + 1}
                        </span>
                      </div>

                      <div className="col-span-4">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.5"
                          value={setItem.weight || ''}
                          placeholder="0"
                          onChange={(e) =>
                            updateSet(
                              exercise.id,
                              setItem.id,
                              'weight',
                              e.target.value
                            )
                          }
                          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-center text-sm font-medium text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                      </div>

                      <div className="col-span-3">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          step="1"
                          value={setItem.reps || ''}
                          placeholder="0"
                          onChange={(e) =>
                            updateSet(
                              exercise.id,
                              setItem.id,
                              'reps',
                              e.target.value
                            )
                          }
                          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-center text-sm font-medium text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                      </div>

                      <div className="col-span-2 text-right text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        {setVolume} кг
                      </div>

                      <div className="col-span-1 flex justify-end">
                        <button
                          type="button"
                          disabled={exercise.sets.length <= 1}
                          onClick={() => removeSet(exercise.id, setItem.id)}
                          aria-label="Удалить подход"
                          className="rounded-lg p-1 text-zinc-400 transition hover:text-red-500 disabled:opacity-25"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Подвал карточки упражнения: кнопка добавления подхода и тоннаж упражнения */}
              <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => addSet(exercise.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-200 active:scale-95 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  <Copy className="h-3.5 w-3.5 text-emerald-500" />
                  + Добавить подход
                </button>

                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Тоннаж:{' '}
                  <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {exTonnage.toLocaleString('ru-RU')} кг
                  </strong>
                </span>
              </div>
            </div>
          );
        })}
      </section>

      {/* Загрузка фото прогресса (формы) с предпросмотром */}
      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <Camera className="h-4 w-4 text-emerald-500" />
              Фото формы (прогресса)
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Приватное хранение в бакете workout-photos
            </p>
          </div>

          <div className="w-28">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="30"
              max="250"
              placeholder="Вес тела, кг"
              value={bodyWeight}
              onChange={(e) => setBodyWeight(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handlePhotoSelect}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50/70 py-5 text-xs font-medium text-zinc-600 transition hover:border-emerald-500 hover:text-emerald-600 active:scale-[0.99] dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300"
        >
          <Camera className="h-6 w-6 text-emerald-500" />
          <span>Снять на камеру iPhone или выбрать из Медиатеки</span>
          <span className="text-[11px] text-zinc-400">
            Нативный выбор iOS · мгновенный предпросмотр
          </span>
        </button>

        {/* Сетка предпросмотра выбранных фотографий */}
        {photos.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
              >
                <div className="relative aspect-[3/4] w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.previewUrl}
                    alt="Предпросмотр фото формы"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    aria-label="Удалить фото"
                    className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-xs transition hover:bg-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Ракурс / заметка..."
                  value={photo.caption}
                  onChange={(e) => updatePhotoCaption(photo.id, e.target.value)}
                  className="w-full border-t border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 placeholder:text-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Самочувствие и заметки */}
      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <HeartPulse className="h-4 w-4 text-rose-500" />
            Самочувствие
          </h2>
          <span className="rounded-lg bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
            {wellbeingRating} / 10
          </span>
        </div>

        <input
          type="range"
          min={1}
          max={10}
          value={wellbeingRating}
          onChange={(e) => setWellbeingRating(Number(e.target.value))}
          className="h-2 w-full cursor-pointer accent-emerald-600"
        />

        <textarea
          rows={2}
          placeholder="Как прошла тренировка? Сон, энергия, пульс, ощущения в связках..."
          value={wellbeingNotes}
          onChange={(e) => setWellbeingNotes(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </section>

      {submitError && (
        <div className="flex items-center gap-2 rounded-2xl bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
          {submitError}
        </div>
      )}

      {savedBanner && (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/15 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          Тренировка успешно сохранена! Общий тоннаж: {stats.totalTonnage} кг.
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-2xl bg-emerald-600 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-60"
      >
        {isSubmitting ? 'Сохранение тренировки...' : 'Сохранить тренировку'}
      </button>
    </form>
  );
}
