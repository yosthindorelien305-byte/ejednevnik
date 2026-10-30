'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Dumbbell,
  Calendar,
  Flame,
  ChevronDown,
  ChevronUp,
  Trash2,
  Camera,
  X,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { hapticImpact } from '@/lib/telegram/webapp';

interface WorkoutSetRow {
  id: string;
  exercise_name: string;
  sets_count: number;
  reps: number;
  weight_kg: number;
  tonnage: number;
}

export interface WorkoutHistoryItem {
  id: string;
  workout_date: string;
  title: string;
  notes: string | null;
  photo_urls: string[];
  total_tonnage: number;
  workout_sets?: WorkoutSetRow[];
  created_at: string;
}

const WORKOUTS_CACHE_KEY = 'ejednevnik_workouts_cache';

export function getLocalCachedWorkouts(): WorkoutHistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(WORKOUTS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // ignore
  }
  return [];
}

export function saveLocalCachedWorkouts(workouts: WorkoutHistoryItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WORKOUTS_CACHE_KEY, JSON.stringify(workouts));
  } catch {
    // ignore
  }
}

export function WorkoutHistory({ refreshTrigger }: { refreshTrigger?: number }) {
  const [workouts, setWorkouts] = useState<WorkoutHistoryItem[]>(() => getLocalCachedWorkouts());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [signedPhotoUrls, setSignedPhotoUrls] = useState<Record<string, string>>({});

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Сохраняем локальные данные, не обнуляем
        const cached = getLocalCachedWorkouts();
        setWorkouts(cached);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('workouts')
        .select('*, workout_sets(*)')
        .eq('user_id', user.id)
        .order('workout_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (!error && data) {
        const fetched = data as WorkoutHistoryItem[];
        // Объединяем с локальными, которых еще нет в БД
        const fetchedIds = new Set(fetched.map((w) => w.id));
        const localOnly = getLocalCachedWorkouts().filter((w) => !fetchedIds.has(w.id));
        const merged = [...fetched, ...localOnly];

        setWorkouts(merged);
        saveLocalCachedWorkouts(merged);

        // Генерируем подписанные URL для превью фото
        const allPhotos: string[] = [];
        merged.forEach((w: WorkoutHistoryItem) => {
          if (w.photo_urls && w.photo_urls.length > 0) {
            allPhotos.push(...w.photo_urls);
          }
        });

        if (allPhotos.length > 0) {
          const map: Record<string, string> = {};
          for (const raw of allPhotos) {
            const clean = raw.replace(/^workout-photos\//, '');
            const { data: sData } = await supabase.storage
              .from('workout-photos')
              .createSignedUrl(clean, 3600);
            if (sData?.signedUrl) {
              map[raw] = sData.signedUrl;
            }
          }
          setSignedPhotoUrls(map);
        }
      }
    } catch {
      // При сетевой ошибке используем локальный кэш
      setWorkouts(getLocalCachedWorkouts());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory, refreshTrigger]);

  const handleDelete = async (workoutId: string) => {
    hapticImpact('medium');
    if (!confirm('Удалить эту тренировку из истории?')) return;

    setWorkouts((prev) => {
      const filtered = prev.filter((w) => w.id !== workoutId);
      saveLocalCachedWorkouts(filtered);
      return filtered;
    });

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    await supabase.from('workouts').delete().eq('id', workoutId);
  };

  const totalAllTonnage = workouts.reduce(
    (sum, w) => sum + (Number(w.total_tonnage) || 0),
    0
  );

  if (isLoading && workouts.length === 0) {
    return (
      <div className="space-y-3">
        <div className="h-20 animate-pulse rounded-3xl border border-white/5 bg-[#24201E]" />
        <div className="h-28 animate-pulse rounded-3xl border border-white/5 bg-[#24201E]" />
      </div>
    );
  }

  if (workouts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-white/5 bg-gradient-to-b from-[#26211F] to-[#1D1918] p-8 text-center shadow-xl shadow-black/40">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5BA42]/10 text-[#F5BA42]">
          <Dumbbell className="h-6 w-6" />
        </div>
        <h3 className="mt-3 text-sm font-bold text-[#FAF7F5] uppercase">
          История тренировок пуста
        </h3>
        <p className="mt-1 max-w-xs text-xs text-[#A8A199]">
          Заполните форму выше и нажмите «Сохранить тренировку» — все ваши сплиты будут надежно храниться здесь.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Сводная плашка истории */}
      <div className="flex items-center justify-between rounded-3xl border border-white/5 bg-gradient-to-r from-[#26211F] to-[#1D1918] p-4 shadow-xl shadow-black/40">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-[#A8A199]">
            Всего тренировок: <strong className="text-[#FAF7F5]">{workouts.length}</strong>
          </span>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-black text-[#FAF7F5] tabular-nums">
              {totalAllTonnage.toLocaleString('ru-RU')}
            </span>
            <span className="text-xs font-bold text-[#F5BA42]">КГ ТОННАЖ</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            hapticImpact('light');
            void fetchHistory();
          }}
          aria-label="Обновить историю"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/5 bg-[#141211] text-[#A8A199] transition hover:text-[#F5BA42] active:scale-95"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Список сохраненных тренировок */}
      <div className="space-y-3">
        {workouts.map((w) => {
          const isExpanded = expandedId === w.id;
          const dateStr = w.workout_date
            ? new Date(w.workout_date).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })
            : '';

          return (
            <div
              key={w.id}
              className="overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-b from-[#26211F] to-[#1D1918] shadow-xl shadow-black/40 transition hover:border-white/10"
            >
              <div
                onClick={() => {
                  hapticImpact('light');
                  setExpandedId(isExpanded ? null : w.id);
                }}
                className="flex cursor-pointer items-center justify-between p-4.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#F5BA42] px-2 py-0.5 text-[9px] font-black tracking-wider text-stone-950 uppercase">
                      <Sparkles className="h-2.5 w-2.5" />
                      {w.title}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-medium text-[#A8A199]">
                      <Calendar className="h-3 w-3" />
                      {dateStr}
                    </span>
                  </div>

                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-mono text-xl font-black text-[#FAF7F5] tabular-nums">
                      {Number(w.total_tonnage).toLocaleString('ru-RU')}
                    </span>
                    <span className="text-xs font-bold text-[#F5BA42]">КГ</span>
                    {w.workout_sets && w.workout_sets.length > 0 && (
                      <span className="text-xs text-[#A8A199]">
                        · {w.workout_sets.length} подх.
                      </span>
                    )}
                    {w.photo_urls && w.photo_urls.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-[#F5BA42]">
                        · <Camera className="h-3 w-3" /> {w.photo_urls.length}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(w.id);
                    }}
                    aria-label="Удалить"
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-[#A8A199] transition hover:bg-rose-950/40 hover:text-rose-400 active:scale-95"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>

                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#141211] text-[#A8A199]">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </div>
              </div>

              {/* Раскрывающийся подробный список упражнений и фото */}
              {isExpanded && (
                <div className="border-t border-white/5 bg-[#141211]/60 p-4.5 space-y-3">
                  {w.notes && (
                    <p className="rounded-2xl border border-white/5 bg-[#1E1A18] p-2.5 text-xs text-[#FAF7F5] italic">
                      {w.notes}
                    </p>
                  )}

                  {/* Список упражнений */}
                  {w.workout_sets && w.workout_sets.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-wider text-[#A8A199]">
                        Упражнения:
                      </p>
                      <div className="space-y-1">
                        {w.workout_sets.map((s, idx) => (
                          <div
                            key={s.id || idx}
                            className="flex items-center justify-between rounded-xl border border-white/5 bg-[#1E1A18] px-3 py-1.5 text-xs"
                          >
                            <span className="font-medium text-[#FAF7F5]">
                              {s.exercise_name}
                            </span>
                            <span className="font-mono text-[11px] font-bold text-[#F5BA42] tabular-nums">
                              {s.weight_kg} кг × {s.sets_count} подх. × {s.reps} повт. (
                              {s.tonnage} кг)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Галерея фото формы */}
                  {w.photo_urls && w.photo_urls.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[10px] font-black uppercase tracking-wider text-[#A8A199]">
                        Фото прогресса:
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {w.photo_urls.map((rawRef, i) => {
                          const src = signedPhotoUrls[rawRef] || rawRef;
                          return (
                            <div
                              key={i}
                              onClick={() => setLightboxUrl(src)}
                              className="relative aspect-[3/4] cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-black"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={src}
                                alt="Фото формы"
                                className="h-full w-full object-cover transition hover:scale-105"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Полноэкранный просмотр фото */}
      {lightboxUrl && (
        <div
          role="dialog"
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-6 right-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Фото формы полноэкранное"
            className="max-h-[85dvh] max-w-full rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
