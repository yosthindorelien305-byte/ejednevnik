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
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { hapticImpact, hapticNotification } from '@/lib/telegram/webapp';

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

// Генератор локальных идентификаторов
const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 11);

export function WorkoutForm({ onSubmitWorkout }: WorkoutFormProps) {
  const [workoutDate, setWorkoutDate] = useState<string>('');
  const [workoutType, setWorkoutType] = useState<WorkoutType>('strength');
  const [title, setTitle] = useState<string>('Тяжелый верх');
  const [wellbeingRating, setWellbeingRating] = useState<number>(8);
  const [wellbeingNotes, setWellbeingNotes] = useState<string>('');
  const [bodyWeight, setBodyWeight] = useState<string>('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Динамический список упражнений и подходов
  const [exercises, setExercises] = useState<ExerciseFormItem[]>([
    {
      id: 'ex-init-1',
      name: 'Жим штанги лежа',
      sets: [
        { id: 'set-init-1', weight: 80, reps: 8 },
        { id: 'set-init-2', weight: 80, reps: 8 },
        { id: 'set-init-3', weight: 80, reps: 7 },
      ],
    },
    {
      id: 'ex-init-2',
      name: 'Французский жим',
      sets: [
        { id: 'set-init-4', weight: 32, reps: 10 },
        { id: 'set-init-5', weight: 32, reps: 10 },
      ],
    },
  ]);

  const [photos, setPhotos] = useState<ProgressPhotoPreview[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [savedBanner, setSavedBanner] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Устанавливаем сегодняшнюю дату по умолчанию
    const today = new Intl.DateTimeFormat('en-CA').format(new Date());
    setWorkoutDate(today);
  }, []);

  // Расчет суммарной статистики и тоннажа
  const stats = useMemo(() => {
    let totalTonnage = 0;
    let totalSets = 0;
    let totalReps = 0;
    const perExerciseTonnage: Record<string, number> = {};

    exercises.forEach((ex) => {
      let exTonnage = 0;
      ex.sets.forEach((set) => {
        const weight = Number(set.weight) || 0;
        const reps = Number(set.reps) || 0;
        const setTonnage = weight * reps;
        exTonnage += setTonnage;
        totalSets += 1;
        totalReps += reps;
      });
      perExerciseTonnage[ex.id] = Math.round(exTonnage * 10) / 10;
      totalTonnage += exTonnage;
    });

    return {
      totalTonnage: Math.round(totalTonnage * 10) / 10,
      totalSets,
      totalReps,
      perExerciseTonnage,
    };
  }, [exercises]);

  // Генерация точек для спарклайн-графика интенсивности тоннажа
  const sparklinePoints = useMemo(() => {
    const values = exercises.map((ex) => stats.perExerciseTonnage[ex.id] || 0);
    if (values.length === 0) return '0,20 100,20';
    const max = Math.max(...values, 100);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const width = 120;
    const height = 32;

    const points = values.map((val, idx) => {
      const x = values.length === 1 ? width / 2 : (idx / (values.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return points.join(' ');
  }, [exercises, stats.perExerciseTonnage]);

  // Добавление нового упражнения
  const addExercise = () => {
    hapticImpact('medium');
    const newExId = createId();
    setExercises((prev) => [
      ...prev,
      {
        id: newExId,
        name: '',
        sets: [{ id: createId(), weight: 60, reps: 8 }],
      },
    ]);
  };

  const removeExercise = (exerciseId: string) => {
    hapticImpact('light');
    setExercises((prev) => prev.filter((ex) => ex.id !== exerciseId));
  };

  const updateExerciseName = (exerciseId: string, name: string) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === exerciseId ? { ...ex, name } : ex))
    );
  };

  const addSet = (exerciseId: string) => {
    hapticImpact('light');
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        const lastSet = ex.sets[ex.sets.length - 1];
        const newSet: ExerciseSetItem = {
          id: createId(),
          weight: lastSet ? lastSet.weight : 0,
          reps: lastSet ? lastSet.reps : 8,
        };
        return { ...ex, sets: [...ex.sets, newSet] };
      })
    );
  };

  const removeSet = (exerciseId: string, setId: string) => {
    hapticImpact('light');
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        if (ex.sets.length <= 1) return ex;
        return { ...ex, sets: ex.sets.filter((s) => s.id !== setId) };
      })
    );
  };

  const updateSet = (
    exerciseId: string,
    setId: string,
    field: 'weight' | 'reps',
    val: string
  ) => {
    const num = Math.max(0, parseFloat(val) || 0);
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s) => (s.id === setId ? { ...s, [field]: num } : s)),
        };
      })
    );
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    hapticImpact('medium');

    const addedPhotos: ProgressPhotoPreview[] = Array.from(files).map((file) => ({
      id: createId(),
      file,
      previewUrl: URL.createObjectURL(file),
      caption: '',
    }));

    setPhotos((prev) => [...prev, ...addedPhotos]);
    e.target.value = '';
  };

  const removePhoto = (photoId: string) => {
    hapticImpact('light');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    hapticImpact('medium');
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
              Math.round(ex.sets.reduce((acc, s) => acc + s.reps, 0) / setsCount)
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
              const storagePath = `${user.id}/${yearMonth}/${createId()}.${ext || 'jpg'}`;
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

            // Отправляем структурированный отчет в Telegram-бот
            void fetch('/api/telegram/notify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'workout',
                userId: user.id,
                data: {
                  title: payload.title,
                  workoutDate: payload.workoutDate,
                  totalTonnage: stats.totalTonnage,
                  wellbeingRating: payload.wellbeingRating,
                  wellbeingNotes: payload.wellbeingNotes,
                  exercises: payload.exercises,
                },
              }),
            }).catch(() => null);
          }
        }
      }

      setSubmitError(null);
      setSavedBanner(true);
      hapticNotification('success');
      setTimeout(() => setSavedBanner(false), 4500);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Не удалось сохранить тренировку'
      );
      hapticNotification('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 1. ШАПКА: SUMMARY-БЛОК В СТИЛЕ FITFUSION DARK LUXURY */}
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-[#26211F] via-[#201C1A] to-[#141211] p-5 shadow-2xl shadow-black/60">
        {/* Декоративный теплый фоновый блик */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-[#F5BA42]/10 blur-3xl"
        />

        <div className="relative flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#F5BA42] px-2.5 py-0.5 text-[10px] font-black tracking-wider text-stone-950 uppercase shadow-sm">
                <Sparkles className="h-3 w-3" />
                {title || 'СИЛОВОЙ СПЛИТ'}
              </span>
              <span className="text-[11px] font-semibold tracking-wider text-[#A8A199] uppercase">
                {WORKOUT_TYPE_LABELS[workoutType]}
              </span>
            </div>

            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-[#FAF7F5] tabular-nums">
                {stats.totalTonnage.toLocaleString('ru-RU')}
              </span>
              <span className="text-base font-bold text-[#F5BA42]">КГ</span>
            </div>
            <p className="text-[11px] font-medium tracking-wide text-[#A8A199] uppercase">
              Суммарный тоннаж сессии
            </p>
          </div>

          {/* Мини-график интенсивности (Sparkline) цвета #F5BA42 */}
          <div className="flex flex-col items-end gap-1">
            <div className="flex h-10 w-28 items-center justify-end">
              <svg className="h-8 w-28 overflow-visible" viewBox="0 0 120 32">
                <defs>
                  <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F5BA42" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#F5BA42" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polyline
                  fill="none"
                  stroke="#F5BA42"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={sparklinePoints}
                />
              </svg>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#F5BA42]">
              <TrendingUp className="h-3 w-3" />
              Интенсивность
            </span>
          </div>
        </div>

        {/* Метрики сессии */}
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/5 pt-3.5">
          <div className="rounded-2xl border border-white/5 bg-[#141211]/60 px-2.5 py-2">
            <span className="block text-[10px] font-bold text-[#A8A199] uppercase">
              Упражнений
            </span>
            <span className="font-mono text-base font-bold text-[#FAF7F5] tabular-nums">
              {exercises.length}
            </span>
          </div>
          <div className="rounded-2xl border border-white/5 bg-[#141211]/60 px-2.5 py-2">
            <span className="block text-[10px] font-bold text-[#A8A199] uppercase">
              Подходов
            </span>
            <span className="font-mono text-base font-bold text-[#FAF7F5] tabular-nums">
              {stats.totalSets}
            </span>
          </div>
          <div className="rounded-2xl border border-white/5 bg-[#141211]/60 px-2.5 py-2">
            <span className="block text-[10px] font-bold text-[#A8A199] uppercase">
              Фото формы
            </span>
            <span className="font-mono text-base font-bold text-[#F5BA42] tabular-nums">
              {photos.length}
            </span>
          </div>
        </div>
      </div>

      {/* 2. ПАРАМЕТРЫ ТРЕНИРОВКИ */}
      <section className="space-y-3.5 rounded-3xl border border-white/5 bg-gradient-to-b from-[#26211F] to-[#1D1918] p-4.5 shadow-xl shadow-black/40">
        <h2 className="flex items-center gap-2 text-xs font-black tracking-wider text-[#FAF7F5] uppercase">
          <Dumbbell className="h-4 w-4 text-[#F5BA42]" />
          Параметры сплита
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-[#A8A199] uppercase">
              Дата
            </label>
            <input
              type="date"
              value={workoutDate}
              onChange={(e) => setWorkoutDate(e.target.value)}
              required
              className="w-full rounded-2xl border border-white/10 bg-[#141211] px-3 py-2.5 text-sm font-medium text-[#FAF7F5] focus:border-[#F5BA42] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-[#A8A199] uppercase">
              Тип тренировки
            </label>
            <select
              value={workoutType}
              onChange={(e) => setWorkoutType(e.target.value as WorkoutType)}
              className="w-full rounded-2xl border border-white/10 bg-[#141211] px-3 py-2.5 text-sm font-medium text-[#FAF7F5] focus:border-[#F5BA42] focus:outline-none"
            >
              {(Object.keys(WORKOUT_TYPE_LABELS) as WorkoutType[]).map((key) => (
                <option key={key} value={key} className="bg-[#1D1918] text-[#FAF7F5]">
                  {WORKOUT_TYPE_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-semibold text-[#A8A199] uppercase">
            Название тренировки
          </label>
          <input
            type="text"
            placeholder="Например: Тяжелый верх или Грудь + Трицепс"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-[#141211] px-3.5 py-2.5 text-sm font-medium text-[#FAF7F5] placeholder:text-[#A8A199]/40 focus:border-[#F5BA42] focus:outline-none"
          />
        </div>
      </section>

      {/* 3. УПРАЖНЕНИЯ И ПОДХОДЫ */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-black tracking-wider text-[#FAF7F5] uppercase">
            Упражнения и сеты
          </h2>
          <button
            type="button"
            onClick={addExercise}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-[#F5BA42] px-3.5 py-1.5 text-xs font-bold text-stone-950 shadow-md shadow-[#F5BA42]/15 transition hover:bg-[#e5ad3a] active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Упражнение
          </button>
        </div>

        {exercises.map((exercise, exIndex) => {
          const exTonnage = stats.perExerciseTonnage[exercise.id] ?? 0;

          return (
            <div
              key={exercise.id}
              className="rounded-3xl border border-white/5 bg-gradient-to-b from-[#26211F] to-[#1D1918] p-4.5 shadow-xl shadow-black/40"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#F5BA42]/15 font-mono text-xs font-black text-[#F5BA42] ring-1 ring-[#F5BA42]/25">
                  {exIndex + 1}
                </span>
                <input
                  type="text"
                  required
                  placeholder="Название (Жим, Присед, Тяга...)"
                  value={exercise.name}
                  onChange={(e) => updateExerciseName(exercise.id, e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#141211] px-3.5 py-2 text-sm font-bold text-[#FAF7F5] placeholder:text-[#A8A199]/40 focus:border-[#F5BA42] focus:outline-none"
                />
                {exercises.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeExercise(exercise.id)}
                    aria-label="Удалить упражнение"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-[#A8A199] transition hover:bg-rose-950/40 hover:text-rose-400 active:scale-95"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Заголовки таблицы подходов */}
              <div className="mt-3.5 grid grid-cols-12 items-center gap-2 px-1 text-[10px] font-bold tracking-wider text-[#A8A199] uppercase">
                <span className="col-span-2">Сет</span>
                <span className="col-span-4 text-center">Вес (кг)</span>
                <span className="col-span-3 text-center">Повторы</span>
                <span className="col-span-2 text-right">Тоннаж</span>
                <span className="col-span-1" />
              </div>

              {/* Строки подходов в темных плашках */}
              <div className="mt-2 space-y-2">
                {exercise.sets.map((setItem, setIdx) => {
                  const setVolume =
                    Math.round(setItem.weight * setItem.reps * 10) / 10;

                  return (
                    <div
                      key={setItem.id}
                      className="grid grid-cols-12 items-center gap-2 rounded-2xl border border-white/5 bg-[#141211] p-1.5"
                    >
                      <div className="col-span-2 flex justify-center">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#24201E] font-mono text-xs font-bold text-[#A8A199]">
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
                            updateSet(exercise.id, setItem.id, 'weight', e.target.value)
                          }
                          className="w-full rounded-xl border border-white/5 bg-[#1E1A18] px-2 py-2 text-center font-mono text-base font-bold text-[#FAF7F5] tabular-nums focus:border-[#F5BA42] focus:outline-none"
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
                            updateSet(exercise.id, setItem.id, 'reps', e.target.value)
                          }
                          className="w-full rounded-xl border border-white/5 bg-[#1E1A18] px-2 py-2 text-center font-mono text-base font-bold text-[#FAF7F5] tabular-nums focus:border-[#F5BA42] focus:outline-none"
                        />
                      </div>

                      <div className="col-span-2 text-right font-mono text-xs font-bold text-[#F5BA42] tabular-nums">
                        {setVolume}
                      </div>

                      <div className="col-span-1 flex justify-center">
                        <button
                          type="button"
                          disabled={exercise.sets.length <= 1}
                          onClick={() => removeSet(exercise.id, setItem.id)}
                          aria-label="Удалить подход"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#A8A199] transition hover:text-rose-400 disabled:opacity-20 active:scale-95"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Подвал карточки упражнения: кнопка добавления сета и тоннаж */}
              <div className="mt-3.5 flex items-center justify-between border-t border-white/5 pt-3">
                <button
                  type="button"
                  onClick={() => addSet(exercise.id)}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-white/5 bg-[#24201E] px-3.5 py-1.5 text-xs font-bold text-[#FAF7F5] transition hover:bg-white/10 active:scale-95"
                >
                  <Copy className="h-3.5 w-3.5 text-[#F5BA42]" />
                  + Подход
                </button>

                <div className="text-right">
                  <span className="text-[11px] font-semibold text-[#A8A199]">Тоннаж: </span>
                  <span className="font-mono text-sm font-black text-[#F5BA42] tabular-nums">
                    {exTonnage.toLocaleString('ru-RU')} кг
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* 4. БЛОК ФОТО ФОРМЫ (ПРЕМИАЛЬНЫЙ POLAROID / GALLERY СТИЛЬ) */}
      <section className="space-y-3.5 rounded-3xl border border-white/5 bg-gradient-to-b from-[#26211F] to-[#1D1918] p-4.5 shadow-xl shadow-black/40">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xs font-black tracking-wider text-[#FAF7F5] uppercase">
              <Camera className="h-4 w-4 text-[#F5BA42]" />
              Фото формы и прогресса
            </h2>
            <p className="text-[11px] text-[#A8A199]">
              Приватное шифрованное хранение в облаке
            </p>
          </div>

          <div className="w-28">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="30"
              max="250"
              placeholder="Вес, кг"
              value={bodyWeight}
              onChange={(e) => setBodyWeight(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#141211] px-3 py-1.5 text-center font-mono text-xs font-bold text-[#F5BA42] tabular-nums placeholder:text-[#A8A199]/40 focus:border-[#F5BA42] focus:outline-none"
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

        {/* Кнопка съемки / выбора фото в стиле Luxury Studio */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-[#141211]/80 py-6 text-xs font-bold text-[#FAF7F5] transition active:scale-[0.99] hover:border-[#F5BA42]/60 hover:bg-[#141211]"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F5BA42]/10 text-[#F5BA42] ring-1 ring-[#F5BA42]/25 transition-transform duration-200 group-hover:scale-110">
            <Camera className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <span className="uppercase tracking-wider">
            Снять форму на iPhone или выбрать фото
          </span>
          <span className="text-[10px] font-medium text-[#A8A199]">
            Формат галереи Polaroid · мгновенный рендер
          </span>
        </button>

        {/* Сетка фото прогресса в стиле Polaroid с размытым фоном */}
        {photos.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#141211] p-1.5 shadow-lg"
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.previewUrl}
                    alt="Фото формы"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    aria-label="Удалить фото"
                    className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-white backdrop-blur-md transition hover:bg-rose-600 active:scale-95"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Ракурс / вес..."
                  value={photo.caption}
                  onChange={(e) => updatePhotoCaption(photo.id, e.target.value)}
                  className="mt-1.5 w-full bg-transparent px-2 py-1 text-center text-[11px] font-medium text-[#FAF7F5] placeholder:text-[#A8A199]/40 focus:outline-none"
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. САМОЧУВСТВИЕ И ЗАМЕТКИ */}
      <section className="space-y-3.5 rounded-3xl border border-white/5 bg-gradient-to-b from-[#26211F] to-[#1D1918] p-4.5 shadow-xl shadow-black/40">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xs font-black tracking-wider text-[#FAF7F5] uppercase">
            <HeartPulse className="h-4 w-4 text-[#F5BA42]" />
            Самочувствие & Пульс
          </h2>
          <span className="rounded-full bg-[#F5BA42] px-2.5 py-0.5 font-mono text-xs font-black text-stone-950">
            {wellbeingRating} / 10
          </span>
        </div>

        <input
          type="range"
          min={1}
          max={10}
          value={wellbeingRating}
          onChange={(e) => {
            hapticImpact('light');
            setWellbeingRating(Number(e.target.value));
          }}
          className="h-2 w-full cursor-pointer accent-[#F5BA42]"
        />

        <textarea
          rows={2}
          placeholder="Сон, уровень энергии, памп, ощущения в связках..."
          value={wellbeingNotes}
          onChange={(e) => setWellbeingNotes(e.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-[#141211] p-3 text-sm text-[#FAF7F5] placeholder:text-[#A8A199]/40 focus:border-[#F5BA42] focus:outline-none"
        />
      </section>

      {submitError && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-900/40 bg-[#4A1521]/60 px-4 py-3 text-sm font-medium text-rose-300">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
          {submitError}
        </div>
      )}

      {savedBanner && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-[#F5BA42]/30 bg-gradient-to-r from-[#26211F] to-[#1D1918] px-4 py-3.5 text-sm font-bold text-[#FAF7F5] shadow-xl shadow-black/60">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[#F5BA42]" />
          <span>Тренировка сохранена и отправлена в Telegram! Тоннаж: {stats.totalTonnage} кг</span>
        </div>
      )}

      {/* 6. ГЛАВНАЯ КНОПКА СОХРАНЕНИЯ: НАСЫЩЕННЫЙ ЗОЛОТОЙ АКЦЕНТ #F5BA42 */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-2xl bg-[#F5BA42] py-4 text-sm font-black tracking-wider text-stone-950 uppercase shadow-xl shadow-[#F5BA42]/20 transition-all duration-150 hover:bg-[#e5ad3a] active:scale-[0.98] disabled:opacity-60"
      >
        {isSubmitting ? 'Сохранение в облако...' : 'Сохранить тренировку'}
      </button>
    </form>
  );
}
