'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Sparkles,
  Link2,
  ExternalLink,
  Plus,
  Trash2,
  Camera,
  ImagePlus,
  Check,
  Loader2,
  Send,
  Maximize2,
  X,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { AutoSaveStatus, BooksAndQuranRow } from '@/features/reading/types';

interface PendingUploadPreview {
  id: string;
  previewUrl: string;
  fileName: string;
}

interface ActiveReadingCardProps {
  item: BooksAndQuranRow;
  userId: string | null;
  isRealtimeConnected: boolean;
  onPatchItem: (
    itemId: string,
    patch: Partial<BooksAndQuranRow>
  ) => Promise<boolean>;
}

const KNOWN_BUCKETS = new Set(['quran-pages', 'diary-media', 'workout-photos']);

/**
 * Разбирает строковый путь из массива media_urls вида "quran-pages/uid/book/2026-10/file.jpg"
 * на имя бакета и внутренний путь объекта в Supabase Storage.
 */
function parseStorageReference(ref: string): {
  bucket: string;
  objectPath: string;
} | null {
  if (
    ref.startsWith('http://') ||
    ref.startsWith('https://') ||
    ref.startsWith('blob:') ||
    ref.startsWith('data:')
  ) {
    return null;
  }

  const firstSlash = ref.indexOf('/');
  if (firstSlash === -1) {
    return { bucket: 'quran-pages', objectPath: ref };
  }

  const maybeBucket = ref.slice(0, firstSlash);
  if (KNOWN_BUCKETS.has(maybeBucket)) {
    return {
      bucket: maybeBucket,
      objectPath: ref.slice(firstSlash + 1),
    };
  }

  return { bucket: 'quran-pages', objectPath: ref };
}

/**
 * Извлекает читаемое имя домена из URL для компактного отображения ссылки.
 */
function formatLinkHostname(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return rawUrl;
  }
}

/**
 * Карточка активной книги или суры Корана:
 * 1) Интерактивный ползунок + числовой инпут смены текущей страницы / аята;
 * 2) Поле добавления ссылок на статьи, конспекты и тафсир;
 * 3) Загрузка скриншотов страниц с камеры/медиатеки с миниатюрами и просмотром;
 * 4) Блок заметок и размышлений (тадаббур) с дебаунс-автосохранением.
 */
export function ActiveReadingCard({
  item,
  userId,
  isRealtimeConnected,
  onPatchItem,
}: ActiveReadingCardProps) {
  const isQuran = item.category === 'quran';
  const unitLabel = isQuran ? 'Аят' : 'Страница';
  const unitGenitiveLabel = isQuran ? 'аятов' : 'стр.';

  // 1. Локальное состояние текущей страницы/аята для плавного движения ползунка (60 FPS)
  const [localPosition, setLocalPosition] = useState<number>(
    item.current_position
  );
  const [positionSaveStatus, setPositionSaveStatus] =
    useState<AutoSaveStatus>('idle');
  const positionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingPositionRef = useRef<boolean>(false);

  // 2. Состояние поля добавления новой ссылки
  const [newLinkUrl, setNewLinkUrl] = useState<string>('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isSavingLink, setIsSavingLink] = useState<boolean>(false);

  // 3. Состояние загрузки скриншотов и кэш подписанных URL миниатюр из Supabase Storage
  const [pendingUploads, setPendingUploads] = useState<PendingUploadPreview[]>(
    []
  );
  const [resolvedThumbnails, setResolvedThumbnails] = useState<
    Record<string, string>
  >({});
  const resolvedThumbnailsRef = useRef<Record<string, string>>({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // 4. Состояние блока заметок с автосохранением
  const [localNotes, setLocalNotes] = useState<string>(item.notes ?? '');
  const [notesSaveStatus, setNotesSaveStatus] =
    useState<AutoSaveStatus>('idle');
  const [lastSavedTimeLabel, setLastSavedTimeLabel] = useState<string | null>(
    null
  );
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const telegramTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isTelegramSent, setIsTelegramSent] = useState<boolean>(false);
  const isNotesDirtyRef = useRef<boolean>(false);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // При переключении активной карточки сбрасываем локальные буферы
  useEffect(() => {
    setLocalPosition(item.current_position);
    setLocalNotes(item.notes ?? '');
    isNotesDirtyRef.current = false;
    setNotesSaveStatus('idle');
    setPositionSaveStatus('idle');
    setLinkError(null);
    setUploadError(null);
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Мгновенно подхватываем свежую страницу/аят, пришедшую по Realtime из Telegram-бота
  useEffect(() => {
    if (!isDraggingPositionRef.current) {
      setLocalPosition(item.current_position);
    }
  }, [item.current_position]);

  // Подхватываем обновленные заметки из Telegram-бота, если пользователь сейчас не печатает текст
  useEffect(() => {
    if (!isNotesDirtyRef.current) {
      setLocalNotes(item.notes ?? '');
    }
  }, [item.notes]);

  // Очистка таймеров при размонтировании
  useEffect(() => {
    return () => {
      if (positionTimerRef.current) clearTimeout(positionTimerRef.current);
      if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    };
  }, []);

  useEffect(() => {
    resolvedThumbnailsRef.current = resolvedThumbnails;
  }, [resolvedThumbnails]);

  // Подгрузка подписанных URL (Signed URLs) для миниатюр из закрытых бакетов Supabase Storage
  useEffect(() => {
    let cancelled = false;

    async function resolveMediaUrls() {
      if (!item.media_urls || item.media_urls.length === 0) return;

      const directEntries: Record<string, string> = {};
      const byBucket: Record<string, Array<{ raw: string; path: string }>> = {};

      for (const rawRef of item.media_urls) {
        if (resolvedThumbnailsRef.current[rawRef]) continue;

        const parsed = parseStorageReference(rawRef);
        if (!parsed) {
          directEntries[rawRef] = rawRef;
        } else {
          if (!byBucket[parsed.bucket]) byBucket[parsed.bucket] = [];
          byBucket[parsed.bucket].push({
            raw: rawRef,
            path: parsed.objectPath,
          });
        }
      }

      if (Object.keys(directEntries).length > 0 && !cancelled) {
        setResolvedThumbnails((prev) => ({ ...prev, ...directEntries }));
      }

      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;

      const signedMap: Record<string, string> = {};

      for (const [bucket, entries] of Object.entries(byBucket)) {
        if (entries.length === 0) continue;
        const paths = entries.map((e) => e.path);
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrls(paths, 60 * 60); // Срок действия ссылки — 1 час

        if (!error && data) {
          data.forEach((signedItem, idx) => {
            if (signedItem.signedUrl) {
              signedMap[entries[idx].raw] = signedItem.signedUrl;
            }
          });
        }
      }

      if (!cancelled && Object.keys(signedMap).length > 0) {
        setResolvedThumbnails((prev) => ({ ...prev, ...signedMap }));
      }
    }

    void resolveMediaUrls();
    return () => {
      cancelled = true;
    };
  }, [item.media_urls]);

  // Процент чтения на основе живой позиции ползунка
  const progressPercent = useMemo(() => {
    const safeTarget = Math.max(1, item.total_target);
    return Math.min(100, Math.round((localPosition / safeTarget) * 1000) / 10);
  }, [localPosition, item.total_target]);

  // Отправка отчета о прогрессе чтения книги/Корана в Telegram-бот
  const sendTelegramReport = useCallback(
    async (pos: number, notesOverride?: string | null) => {
      let currentUid = userId;
      if (!currentUid) {
        const supabase = getSupabaseBrowserClient();
        if (supabase) {
          const { data: { user } } = await supabase.auth.getUser();
          currentUid = user?.id ?? null;
        }
      }
      if (!currentUid || item.id.startsWith('demo-')) return;
      try {
        await fetch('/api/telegram/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'reading',
            userId: currentUid,
            data: {
              category: item.category,
              title: item.title,
              currentPosition: pos,
              totalTarget: item.total_target,
              notes: notesOverride !== undefined ? notesOverride : localNotes,
              resourceUrls: item.resource_urls,
            },
          }),
        });
        setIsTelegramSent(true);
        setTimeout(() => setIsTelegramSent(false), 3000);
      } catch {
        // Ошибку сети игнорируем
      }
    },
    [userId, item.id, item.category, item.title, item.total_target, item.resource_urls, localNotes]
  );

  // Дебаунс-фиксация новой страницы / аята в Supabase
  const schedulePositionSave = useCallback(
    (nextPos: number) => {
      const clamped = Math.max(0, Math.min(item.total_target, nextPos));
      setLocalPosition(clamped);
      setPositionSaveStatus('saving');

      if (positionTimerRef.current) {
        clearTimeout(positionTimerRef.current);
      }
      if (telegramTimerRef.current) {
        clearTimeout(telegramTimerRef.current);
      }

      positionTimerRef.current = setTimeout(async () => {
        isDraggingPositionRef.current = false;
        const ok = await onPatchItem(item.id, {
          current_position: clamped,
          last_updated_by: 'web',
        });
        setPositionSaveStatus(ok ? 'saved' : 'error');
      }, 320);

      // Через 1.5 секунды после остановки ползунка отправляем структурированное сообщение в бот
      telegramTimerRef.current = setTimeout(() => {
        void sendTelegramReport(clamped);
      }, 1500);
    },
    [item.id, item.total_target, onPatchItem, sendTelegramReport]
  );

  // Добавление полезной ссылки на статью или толкование (тафсир)
  const handleAddResourceLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkError(null);

    const raw = newLinkUrl.trim();
    if (!raw) return;

    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

    try {
      new URL(normalized);
    } catch {
      setLinkError('Введите корректный адрес ссылки (например, https://quran.com/2/15)');
      return;
    }

    if (item.resource_urls.includes(normalized)) {
      setLinkError('Эта ссылка уже прикреплена к карточке');
      return;
    }

    setIsSavingLink(true);
    const nextUrls = [...item.resource_urls, normalized];
    const ok = await onPatchItem(item.id, {
      resource_urls: nextUrls,
      last_updated_by: 'web',
    });
    setIsSavingLink(false);

    if (ok) {
      setNewLinkUrl('');
    } else {
      setLinkError('Не удалось сохранить ссылку в базу');
    }
  };

  // Удаление прикрепленной ссылки
  const handleRemoveResourceLink = async (urlToRemove: string) => {
    const nextUrls = item.resource_urls.filter((u) => u !== urlToRemove);
    await onPatchItem(item.id, {
      resource_urls: nextUrls,
      last_updated_by: 'web',
    });
  };

  // Загрузка выбранных скриншотов с мгновенным превью и сохранением в Supabase Storage
  const handleScreenshotFilesSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setUploadError(null);
    const files = Array.from(fileList);
    e.target.value = '';

    // Создаем мгновенные превью для отображения миниатюр до завершения сетевой загрузки
    const optimisticPreviews: PendingUploadPreview[] = files.map((file) => ({
      id: crypto.randomUUID(),
      previewUrl: URL.createObjectURL(file),
      fileName: file.name,
    }));

    setPendingUploads((prev) => [...prev, ...optimisticPreviews]);

    const supabase = getSupabaseBrowserClient();
    const uploadedRefs: string[] = [];
    const newThumbMap: Record<string, string> = {};

    try {
      if (supabase && userId) {
        const yearMonth = new Date().toISOString().slice(0, 7);

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const previewItem = optimisticPreviews[i];
          const ext = (file.name.split('.').pop() || 'jpg')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
          const objectPath = `${userId}/${item.category}/${yearMonth}/${crypto.randomUUID()}.${
            ext || 'jpg'
          }`;

          const { error } = await supabase.storage
            .from('quran-pages')
            .upload(objectPath, file, {
              contentType: file.type || 'image/jpeg',
              upsert: false,
            });

          if (error) {
            throw new Error(error.message);
          }

          const storageRef = `quran-pages/${objectPath}`;
          uploadedRefs.push(storageRef);
          // Используем локальный Object URL для мгновенного рендера без повторного скачивания
          newThumbMap[storageRef] = previewItem.previewUrl;
        }
      } else {
        // Локальный демо-режим без авторизации: сохраняем blob-превью в состоянии карточки
        optimisticPreviews.forEach((p) => {
          uploadedRefs.push(p.previewUrl);
          newThumbMap[p.previewUrl] = p.previewUrl;
        });
      }

      setResolvedThumbnails((prev) => ({ ...prev, ...newThumbMap }));

      const nextMedia = [...(item.media_urls ?? []), ...uploadedRefs];
      await onPatchItem(item.id, {
        media_urls: nextMedia,
        last_updated_by: 'web',
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Ошибка загрузки скриншота';
      setUploadError(message);
      // Освобождаем временные URL только при неуспешной загрузке
      optimisticPreviews.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    } finally {
      const finishedIds = new Set(optimisticPreviews.map((p) => p.id));
      setPendingUploads((prev) => prev.filter((p) => !finishedIds.has(p.id)));
    }
  };

  // Удаление миниатюры скриншота из карточки
  const handleRemoveScreenshot = async (rawRef: string) => {
    const nextMedia = item.media_urls.filter((m) => m !== rawRef);
    await onPatchItem(item.id, {
      media_urls: nextMedia,
      last_updated_by: 'web',
    });

    // Опционально удаляем сам файл из Supabase Storage, если пользователь авторизован
    const parsed = parseStorageReference(rawRef);
    const supabase = getSupabaseBrowserClient();
    if (parsed && supabase && userId) {
      await supabase.storage
        .from(parsed.bucket)
        .remove([parsed.objectPath])
        .catch(() => null);
    }
  };

  // Принудительное сохранение заметки (вызывается по таймеру и при потере фокуса)
  const flushNotesSave = useCallback(
    async (textToSave: string) => {
      if (!isNotesDirtyRef.current) return;

      if (notesTimerRef.current) {
        clearTimeout(notesTimerRef.current);
        notesTimerRef.current = null;
      }

      setNotesSaveStatus('saving');
      const ok = await onPatchItem(item.id, {
        notes: textToSave.trim() ? textToSave : null,
        last_updated_by: 'web',
      });

      if (ok) {
        isNotesDirtyRef.current = false;
        setNotesSaveStatus('saved');
        setLastSavedTimeLabel(
          new Date().toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          })
        );
      } else {
        setNotesSaveStatus('error');
      }
    },
    [item.id, onPatchItem]
  );

  // Обработка ввода в блоке заметок с дебаунсом 800 мс
  const handleNotesChange = (nextText: string) => {
    setLocalNotes(nextText);
    isNotesDirtyRef.current = true;
    setNotesSaveStatus('saving');

    if (notesTimerRef.current) {
      clearTimeout(notesTimerRef.current);
    }

    notesTimerRef.current = setTimeout(() => {
      void flushNotesSave(nextText);
    }, 800);
  };

  const formattedUpdatedAt = useMemo(() => {
    if (!isHydrated) return '';
    try {
      return new Date(item.updated_at).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }, [item.updated_at, isHydrated]);

  return (
    <article className="overflow-hidden rounded-3xl border border-zinc-200/90 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Верхняя шапка активной книги / суры */}
      <div
        className={`p-5 ${
          isQuran
            ? 'bg-gradient-to-br from-emerald-950 via-teal-950 to-zinc-900 text-white'
            : 'bg-gradient-to-br from-sky-950 via-slate-900 to-zinc-900 text-white'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              isQuran
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-sky-500/20 text-sky-300'
            }`}
          >
            {isQuran ? (
              <Sparkles className="h-3.5 w-3.5" />
            ) : (
              <BookOpen className="h-3.5 w-3.5" />
            )}
            {isQuran ? 'Активная сура · Коран' : 'Активная книга'}
          </span>

          {/* Индикатор источника последнего обновления (Сайт или Telegram-бот) */}
          <div className="flex items-center gap-1.5">
            {item.last_updated_by === 'telegram' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-400/20 px-2.5 py-1 text-[11px] font-medium text-sky-200 ring-1 ring-sky-400/30">
                <Send className="h-3 w-3" />
                Из Telegram {formattedUpdatedAt && `· ${formattedUpdatedAt}`}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-zinc-300">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isRealtimeConnected ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                {formattedUpdatedAt
                  ? `Обновлено в ${formattedUpdatedAt}`
                  : 'Синхронизировано'}
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold tracking-tight">
              {item.title}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-300">
              {unitLabel}{' '}
              <strong className="font-semibold text-white">
                {localPosition}
              </strong>{' '}
              из {item.total_target}
            </p>
          </div>

          <div className="text-right">
            <span
              className={`text-2xl font-extrabold tabular-nums ${
                isQuran ? 'text-emerald-300' : 'text-sky-300'
              }`}
            >
              {progressPercent}%
            </span>
          </div>
        </div>

        {/* Визуальная шкала прогресса */}
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/15">
          <div
            style={{ width: `${progressPercent}%` }}
            className={`h-full rounded-full transition-all duration-200 ${
              isQuran
                ? 'bg-gradient-to-r from-emerald-400 to-teal-300'
                : 'bg-gradient-to-r from-sky-400 to-indigo-300'
            }`}
          />
        </div>
      </div>

      {/* Тело карточки с 4 интерактивными блоками */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
        {/* БЛОК 1. Ползунок и точный числовой ввод текущей страницы / аята */}
        <section className="space-y-3 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor={`position-input-${item.id}`}
              className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400"
            >
              Текущая позиция ({unitLabel.toLowerCase()})
            </label>

            <span className="text-[11px] text-zinc-400">
              {positionSaveStatus === 'saving' && 'Сохраняем позицию...'}
              {positionSaveStatus === 'saved' && '✓ Позиция сохранена'}
              {positionSaveStatus === 'error' && 'Ошибка сохранения'}
            </span>
          </div>

          {/* Интерактивный ползунок */}
          <input
            type="range"
            min={0}
            max={item.total_target}
            value={localPosition}
            aria-label={`Ползунок: ${unitLabel}`}
            onPointerDown={() => {
              isDraggingPositionRef.current = true;
            }}
            onChange={(e) => schedulePositionSave(Number(e.target.value))}
            className={`h-2.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 dark:bg-zinc-800 ${
              isQuran ? 'accent-emerald-500' : 'accent-sky-500'
            }`}
          />

          {/* Числовой инпут + быстрые шаги */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <input
                id={`position-input-${item.id}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={item.total_target}
                value={localPosition}
                onChange={(e) => {
                  const parsed = parseInt(e.target.value, 10);
                  schedulePositionSave(Number.isNaN(parsed) ? 0 : parsed);
                }}
                className="w-24 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-center text-base font-bold text-zinc-900 tabular-nums focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                из {item.total_target} {unitGenitiveLabel}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[-1, 1, 5, 15].map((delta) => (
                <button
                  key={delta}
                  type="button"
                  onClick={() => schedulePositionSave(localPosition + delta)}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-emerald-500/50 active:scale-95 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  {delta > 0 ? `+${delta}` : delta}
                </button>
              ))}

              <button
                type="button"
                onClick={() => void sendTelegramReport(localPosition)}
                disabled={isTelegramSent}
                className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition active:scale-95 ${
                  isTelegramSent
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'bg-sky-500/15 text-sky-700 hover:bg-sky-500/25 dark:text-sky-300'
                }`}
                title="Отправить текущий отчет о прочитанном в Telegram"
              >
                {isTelegramSent ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    В боте!
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    В бот
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* БЛОК 2. Поле добавления ссылок на статьи, конспекты или толкования (тафсир) */}
        <section className="space-y-3 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              <Link2 className="h-3.5 w-3.5 text-emerald-500" />
              {isQuran
                ? 'Ссылки на тафсир и разборы'
                : 'Ссылки на статьи и конспекты'}
            </h3>
            <span className="text-[11px] text-zinc-400">
              {item.resource_urls.length} шт.
            </span>
          </div>

          <form onSubmit={handleAddResourceLink} className="flex gap-2">
            <input
              type="url"
              value={newLinkUrl}
              onChange={(e) => setNewLinkUrl(e.target.value)}
              placeholder={
                isQuran
                  ? 'https://quran.com/... или статья с тафсиром'
                  : 'https://... статья, разбор или заметка'
              }
              className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <button
              type="submit"
              disabled={isSavingLink || !newLinkUrl.trim()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-500 disabled:opacity-50 active:scale-95"
            >
              {isSavingLink ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Добавить
            </button>
          </form>

          {linkError && (
            <p className="flex items-center gap-1.5 text-xs text-rose-500">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {linkError}
            </p>
          )}

          {item.resource_urls.length > 0 ? (
            <ul className="space-y-2">
              {item.resource_urls.map((url) => (
                <li
                  key={url}
                  className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/70 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/50"
                >
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 flex-1 items-center gap-2 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{url}</span>
                    <span className="hidden shrink-0 rounded-md bg-zinc-200/70 px-1.5 py-0.5 text-[10px] text-zinc-600 sm:inline dark:bg-zinc-700 dark:text-zinc-300">
                      {formatLinkHostname(url)}
                    </span>
                  </a>

                  <button
                    type="button"
                    onClick={() => handleRemoveResourceLink(url)}
                    aria-label="Удалить ссылку"
                    className="rounded-lg p-1 text-zinc-400 transition hover:bg-rose-500/10 hover:text-rose-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-400">
              Ссылок пока нет. Добавьте материал выше или отправьте ссылку с
              комментарием в Telegram-бота.
            </p>
          )}
        </section>

        {/* БЛОК 3. Загрузка скриншотов страниц с предпросмотром миниатюр */}
        <section className="space-y-3 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              <Camera className="h-3.5 w-3.5 text-emerald-500" />
              Скриншоты страниц и фото
            </h3>
            <span className="text-[11px] text-zinc-400">
              {item.media_urls.length + pendingUploads.length} снимков
            </span>
          </div>

          {/* Нативные скрытые инпуты для iOS Safari / Standalone PWA */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleScreenshotFilesSelected}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleScreenshotFilesSelected}
            className="hidden"
          />

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-emerald-500/50 bg-emerald-500/5 px-3 py-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/10 active:scale-98 dark:text-emerald-300"
            >
              <ImagePlus className="h-4 w-4 shrink-0" />
              Загрузить скриншот
            </button>

            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 active:scale-98 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              <Camera className="h-4 w-4 shrink-0 text-emerald-500" />
              Снять страницу
            </button>
          </div>

          {uploadError && (
            <p className="flex items-center gap-1.5 text-xs text-rose-500">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {uploadError}
            </p>
          )}

          {/* Сетка миниатюр сохраненных и загружаемых скриншотов */}
          {(item.media_urls.length > 0 || pendingUploads.length > 0) && (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {/* Оптимистичные миниатюры в процессе отправки в Storage */}
              {pendingUploads.map((pending) => (
                <div
                  key={pending.id}
                  className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-emerald-500/40 bg-zinc-900"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pending.previewUrl}
                    alt={pending.fileName}
                    className="h-full w-full object-cover opacity-60"
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/35 text-white">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-[10px] font-medium">Загрузка...</span>
                  </div>
                </div>
              ))}

              {/* Сохраненные в базе скриншоты (с сайта и из Telegram-бота) */}
              {item.media_urls.map((rawRef, idx) => {
                const thumbUrl = resolvedThumbnails[rawRef];

                return (
                  <div
                    key={`${rawRef}-${idx}`}
                    className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800"
                  >
                    {thumbUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={thumbUrl}
                          alt={`Скриншот ${idx + 1}`}
                          onClick={() => setLightboxUrl(thumbUrl)}
                          className="h-full w-full cursor-pointer object-cover transition duration-200 group-hover:scale-105"
                        />
                        <button
                          type="button"
                          onClick={() => setLightboxUrl(thumbUrl)}
                          aria-label="Увеличить скриншот"
                          className="absolute bottom-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-xs"
                        >
                          <Maximize2 className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center text-[10px] text-zinc-400">
                        <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                        <span>Загрузка превью</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveScreenshot(rawRef)}
                      aria-label="Удалить скриншот"
                      className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-xs transition hover:bg-rose-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* БЛОК 4. Заметки, цитаты и размышления (тадаббур) с автосохранением */}
        <section className="space-y-2.5 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor={`notes-textarea-${item.id}`}
              className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400"
            >
              <FileText className="h-3.5 w-3.5 text-emerald-500" />
              {isQuran
                ? 'Размышления над аятами (тадаббур)'
                : 'Заметки и ключевые цитаты'}
            </label>

            {/* Индикатор статуса автосохранения */}
            <span className="inline-flex items-center gap-1 text-[11px] font-medium">
              {notesSaveStatus === 'saving' && (
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Сохранение...
                </span>
              )}
              {notesSaveStatus === 'saved' && (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3 w-3" />
                  Сохранено{lastSavedTimeLabel ? ` в ${lastSavedTimeLabel}` : ''}
                </span>
              )}
              {notesSaveStatus === 'error' && (
                <span className="text-rose-500">Ошибка автосохранения</span>
              )}
              {notesSaveStatus === 'idle' && (
                <span className="text-zinc-400">Автосохранение включено</span>
              )}
            </span>
          </div>

          <textarea
            id={`notes-textarea-${item.id}`}
            rows={4}
            value={localNotes}
            onChange={(e) => handleNotesChange(e.target.value)}
            onBlur={() => {
              void flushNotesSave(localNotes);
            }}
            placeholder={
              isQuran
                ? 'Запишите смыслы аята, выводы для практики или заметку из тафсира...'
                : 'Выпишите сильную мысль автора, цитату или идею для внедрения...'
            }
            className="w-full resize-y rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5 text-base leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100"
          />
        </section>
      </div>

      {/* Полноэкранный просмотр миниатюры скриншота (Lightbox) */}
      {lightboxUrl && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            aria-label="Закрыть просмотр"
            className="absolute top-6 right-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Полноэкранный скриншот страницы"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85dvh] max-w-full rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}
    </article>
  );
}
