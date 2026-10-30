'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Sparkles,
  Plus,
  RefreshCw,
  Wifi,
  WifiOff,
  Send,
  X,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { SURAH_AYAH_COUNTS } from '@/features/telegram-sync/utils/naturalLanguageParser';
import { ActiveReadingCard } from '@/features/reading/components/ActiveReadingCard';
import type {
  BooksAndQuranRow,
  ReadingCategory,
} from '@/features/reading/types';

interface BooksAndQuranPageClientProps {
  initialItems?: BooksAndQuranRow[];
  initialUserId?: string | null;
}

type CategoryFilter = 'all' | ReadingCategory;

// Стартовые демонстрационные записи с детерминированными датами (без гидратационных расхождений SSR/Client)
const DEMO_INITIAL_ITEMS: BooksAndQuranRow[] = [
  {
    id: 'demo-book-atomic',
    user_id: 'demo-user',
    category: 'book',
    title: 'Атомные привычки',
    current_position: 45,
    total_target: 300,
    progress_percent: 15,
    notes:
      'Привычки — это сложные проценты самосовершенствования. Фокус на системе, а не на разовой цели.',
    resource_urls: ['https://jamesclear.com/atomic-habits-summary'],
    media_urls: [],
    last_updated_by: 'telegram',
    created_at: '2026-10-29T09:30:00.000Z',
    updated_at: '2026-10-29T09:30:00.000Z',
  },
  {
    id: 'demo-quran-baqarah',
    user_id: 'demo-user',
    category: 'quran',
    title: 'Сура 2 «Аль-Бакара»',
    current_position: 15,
    total_target: 286,
    progress_percent: 5.24,
    notes:
      'Размышление над первыми аятами о признаках богобоязненных (аль-муттакун) и искренности сердца.',
    resource_urls: ['https://quran.com/2/1-15'],
    media_urls: [],
    last_updated_by: 'telegram',
    created_at: '2026-10-29T09:00:00.000Z',
    updated_at: '2026-10-29T09:00:00.000Z',
  },
];

function sortByUpdatedDesc(rows: BooksAndQuranRow[]): BooksAndQuranRow[] {
  return [...rows].sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

function normalizeRow(raw: Partial<BooksAndQuranRow>): BooksAndQuranRow {
  const current = Number(raw.current_position ?? 0);
  const total = Math.max(1, Number(raw.total_target ?? 1));
  return {
    id: String(raw.id ?? crypto.randomUUID()),
    user_id: String(raw.user_id ?? ''),
    category: raw.category === 'quran' ? 'quran' : 'book',
    title: String(raw.title ?? 'Без названия'),
    current_position: current,
    total_target: total,
    progress_percent:
      raw.progress_percent !== undefined
        ? Number(raw.progress_percent)
        : Math.round((current / total) * 10000) / 100,
    notes: raw.notes ?? null,
    resource_urls: Array.isArray(raw.resource_urls) ? raw.resource_urls : [],
    media_urls: Array.isArray(raw.media_urls) ? raw.media_urls : [],
    last_updated_by: raw.last_updated_by === 'telegram' ? 'telegram' : 'web',
    created_at: raw.created_at ?? new Date().toISOString(),
    updated_at: raw.updated_at ?? new Date().toISOString(),
  };
}

/**
 * Клиентский контроллер раздела «Книги и Коран»:
 * - При открытии запрашивает свежие записи из таблицы public.books_and_quran;
 * - Подписывается на Supabase Realtime (postgres_changes) для мгновенного обновления без перезагрузки,
 *   когда пользователь отправляет страницу, аят, ссылку или скриншот в Telegram-бота;
 * - Дополнительно ревалидирует данные при возврате в приложение на iPhone (visibilitychange).
 */
export function BooksAndQuranPageClient({
  initialItems,
  initialUserId = null,
}: BooksAndQuranPageClientProps) {
  const hasServerPayload = initialItems !== undefined;

  const [userId, setUserId] = useState<string | null>(initialUserId);
  const [items, setItems] = useState<BooksAndQuranRow[]>(() =>
    hasServerPayload
      ? sortByUpdatedDesc(initialItems.map(normalizeRow))
      : DEMO_INITIAL_ITEMS
  );
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    hasServerPayload ? initialItems[0]?.id ?? null : DEMO_INITIAL_ITEMS[0].id
  );

  const [isLoading, setIsLoading] = useState<boolean>(!hasServerPayload);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isRealtimeConnected, setIsRealtimeConnected] =
    useState<boolean>(false);
  const [liveToast, setLiveToast] = useState<string | null>(null);

  // Состояние компактной формы добавления новой книги или суры
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false);
  const [newCategory, setNewCategory] = useState<ReadingCategory>('book');
  const [newTitle, setNewTitle] = useState<string>('');
  const [newTotalTarget, setNewTotalTarget] = useState<string>('300');
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Показ всплывающего уведомления при приходе данных из Telegram-бота
  const showTelegramSyncToast = useCallback((message: string) => {
    setLiveToast(message);
  }, []);

  useEffect(() => {
    if (!liveToast) return;
    const timer = setTimeout(() => setLiveToast(null), 4200);
    return () => clearTimeout(timer);
  }, [liveToast]);

  // Загрузка актуального списка книг и сур из Supabase
  const fetchFreshItems = useCallback(
    async (explicitUid?: string | null, silent = false) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setIsLoading(false);
        return;
      }

      if (!silent) setIsRefreshing(true);

      try {
        let currentUid = explicitUid ?? userId;
        if (!currentUid) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          currentUid = user?.id ?? null;
          if (currentUid) setUserId(currentUid);
        }

        if (!currentUid) {
          setIsLoading(false);
          setIsRefreshing(false);
          return;
        }

        const { data, error } = await supabase
          .from('books_and_quran')
          .select('*')
          .eq('user_id', currentUid)
          .order('updated_at', { ascending: false });

        if (!error && data) {
          const normalized = sortByUpdatedDesc(data.map(normalizeRow));
          setItems(normalized);
          setSelectedId((prevSelected) => {
            if (
              prevSelected &&
              normalized.some((row) => row.id === prevSelected)
            ) {
              return prevSelected;
            }
            return normalized[0]?.id ?? null;
          });
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [userId]
  );

  // Первичная подгрузка при монтировании страницы
  useEffect(() => {
    void fetchFreshItems(initialUserId, false);
  }, [fetchFreshItems, initialUserId]);

  // Live-подписка Supabase Realtime (postgres_changes) на изменения таблицы books_and_quran
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !userId) return;

    const channel = supabase
      .channel(`books-and-quran-sync:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'books_and_quran',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const inserted = normalizeRow(
              payload.new as Partial<BooksAndQuranRow>
            );
            setItems((prev) => {
              const withoutDup = prev.filter((r) => r.id !== inserted.id);
              return sortByUpdatedDesc([inserted, ...withoutDup]);
            });
            setSelectedId(inserted.id);

            if (inserted.last_updated_by === 'telegram') {
              showTelegramSyncToast(
                `Из Telegram добавлено: «${inserted.title}» (${inserted.current_position}/${inserted.total_target})`
              );
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = normalizeRow(
              payload.new as Partial<BooksAndQuranRow>
            );
            setItems((prev) =>
              sortByUpdatedDesc(
                prev.map((row) => (row.id === updated.id ? updated : row))
              )
            );

            if (updated.last_updated_by === 'telegram') {
              setSelectedId(updated.id);
              const unit = updated.category === 'quran' ? 'аят' : 'стр.';
              showTelegramSyncToast(
                `Обновлено из Telegram: «${updated.title}» — ${unit} ${updated.current_position}`
              );
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = String(
              (payload.old as { id?: string })?.id ?? ''
            );
            if (!deletedId) return;
            setItems((prev) => {
              const remaining = prev.filter((row) => row.id !== deletedId);
              setSelectedId((curr) =>
                curr === deletedId ? remaining[0]?.id ?? null : curr
              );
              return remaining;
            });
          }
        }
      )
      .subscribe((status) => {
        setIsRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      void supabase.removeChannel(channel);
      setIsRealtimeConnected(false);
    };
  }, [userId, showTelegramSyncToast]);

  // Автоматическая ревалидация при возврате на вкладку / в Standalone PWA на iPhone после Telegram
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void fetchFreshItems(userId, true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [fetchFreshItems, userId]);

  // Отфильтрованный список записей по выбранной вкладке
  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return items;
    return items.filter((item) => item.category === activeFilter);
  }, [items, activeFilter]);

  // Определение текущей активной книги / суры
  const activeItem = useMemo(() => {
    if (filteredItems.length === 0) return null;
    return (
      filteredItems.find((i) => i.id === selectedId) ?? filteredItems[0]
    );
  }, [filteredItems, selectedId]);

  // Оптимистичное обновление полей карточки с записью в Supabase
  const handlePatchItem = useCallback(
    async (
      itemId: string,
      patch: Partial<BooksAndQuranRow>
    ): Promise<boolean> => {
      const nowIso = new Date().toISOString();

      setItems((prev) =>
        sortByUpdatedDesc(
          prev.map((row) =>
            row.id === itemId
              ? normalizeRow({ ...row, ...patch, updated_at: nowIso })
              : row
          )
        )
      );

      const supabase = getSupabaseBrowserClient();
      if (!supabase || !userId || itemId.startsWith('demo-')) {
        return true;
      }

      const { error } = await supabase
        .from('books_and_quran')
        .update({
          ...patch,
          last_updated_by: 'web',
        })
        .eq('id', itemId)
        .eq('user_id', userId);

      if (error) {
        // При ошибке откатываем к актуальному состоянию БД
        await fetchFreshItems(userId, true);
        return false;
      }

      return true;
    },
    [userId, fetchFreshItems]
  );

  // Автоподстановка числа аятов при вводе номера суры (например: «Сура 18»)
  const handleNewTitleChange = (val: string) => {
    setNewTitle(val);
    if (newCategory === 'quran') {
      const match = val.match(/(\d{1,3})/);
      if (match) {
        const surahNum = parseInt(match[1], 10);
        if (surahNum >= 1 && surahNum <= 114) {
          setNewTotalTarget(String(SURAH_AYAH_COUNTS[surahNum - 1]));
        }
      }
    }
  };

  // Создание новой книги или суры
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = newTitle.trim();
    const parsedTotal = Math.max(1, parseInt(newTotalTarget, 10) || 300);
    if (!trimmedTitle) return;

    setIsCreating(true);
    const supabase = getSupabaseBrowserClient();

    try {
      if (supabase && userId) {
        const { data, error } = await supabase
          .from('books_and_quran')
          .insert({
            user_id: userId,
            category: newCategory,
            title: trimmedTitle,
            current_position: 0,
            total_target: parsedTotal,
            last_updated_by: 'web',
          })
          .select('*')
          .single();

        if (!error && data) {
          const created = normalizeRow(data);
          setItems((prev) =>
            sortByUpdatedDesc([
              created,
              ...prev.filter((r) => r.id !== created.id),
            ])
          );
          setSelectedId(created.id);

          // Отправляем уведомление в Telegram-бот о создании новой книги или суры
          void fetch('/api/telegram/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'reading',
              userId,
              data: {
                category: created.category,
                title: created.title,
                currentPosition: created.current_position,
                totalTarget: created.total_target,
                notes: created.notes,
                resourceUrls: created.resource_urls,
              },
            }),
          }).catch(() => null);
        }
      } else {
        const localItem = normalizeRow({
          id: `demo-${crypto.randomUUID()}`,
          user_id: 'demo-user',
          category: newCategory,
          title: trimmedTitle,
          current_position: 0,
          total_target: parsedTotal,
          last_updated_by: 'web',
        });
        setItems((prev) => [localItem, ...prev]);
        setSelectedId(localItem.id);
      }

      setNewTitle('');
      setIsAddOpen(false);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Живое уведомление при получении обновления из Telegram-бота */}
      {liveToast && (
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-2.5 text-xs font-medium text-sky-800 shadow-xs dark:text-sky-200"
        >
          <span className="flex items-center gap-2">
            <Send className="h-3.5 w-3.5 shrink-0 text-sky-500" />
            {liveToast}
          </span>
          <button
            type="button"
            onClick={() => setLiveToast(null)}
            className="rounded-lg p-0.5 text-sky-600 hover:bg-sky-500/15 dark:text-sky-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Панель статуса синхронизации и фильтров разделов */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-900">
          {(
            [
              { id: 'all', label: 'Все' },
              { id: 'book', label: '📖 Книги' },
              { id: 'quran', label: '🕋 Коран' },
            ] as const
          ).map((tab) => {
            const active = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-white'
                    : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${
              isRealtimeConnected
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
            }`}
          >
            {isRealtimeConnected ? (
              <>
                <Wifi className="h-3 w-3" />
                Live Sync
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                {userId ? 'Подключение...' : 'Демо-режим'}
              </>
            )}
          </span>

          <button
            type="button"
            onClick={() => void fetchFreshItems(userId, false)}
            aria-label="Синхронизировать с базой"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 transition hover:text-emerald-600 active:scale-95 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
            />
          </button>

          <button
            type="button"
            onClick={() => setIsAddOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95 dark:bg-zinc-100 dark:text-zinc-900"
          >
            <Plus className="h-3.5 w-3.5" />
            Добавить
          </button>
        </div>
      </div>

      {/* Раскрываемая форма добавления новой книги или суры */}
      {isAddOpen && (
        <form
          onSubmit={handleCreateItem}
          className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Новая книга или сура
            </h3>
            <div className="inline-flex rounded-xl bg-zinc-100 p-0.5 dark:bg-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setNewCategory('book');
                  setNewTotalTarget('300');
                }}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  newCategory === 'book'
                    ? 'bg-white text-zinc-900 shadow-2xs dark:bg-zinc-700 dark:text-white'
                    : 'text-zinc-500'
                }`}
              >
                📖 Книга
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewCategory('quran');
                  setNewTotalTarget('286');
                }}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  newCategory === 'quran'
                    ? 'bg-white text-zinc-900 shadow-2xs dark:bg-zinc-700 dark:text-white'
                    : 'text-zinc-500'
                }`}
              >
                🕋 Сура Корана
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => handleNewTitleChange(e.target.value)}
              placeholder={
                newCategory === 'quran'
                  ? 'Например: Сура 18 Аль-Кахф'
                  : 'Например: Чистый код'
              }
              className=" rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:bg-white focus:outline-none sm:col-span-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <input
              type="number"
              inputMode="numeric"
              min={1}
              required
              value={newTotalTarget}
              onChange={(e) => setNewTotalTarget(e.target.value)}
              placeholder={
                newCategory === 'quran' ? 'Всего аятов' : 'Всего страниц'
              }
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="rounded-xl px-3 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isCreating || !newTitle.trim()}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {isCreating ? 'Сохранение...' : 'Создать карточку'}
            </button>
          </div>
        </form>
      )}

      {/* Горизонтальный переключатель всех книг и сур (отсортирован по свежести updated_at) */}
      {filteredItems.length > 1 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {filteredItems.map((entry) => {
            const isSelected = activeItem?.id === entry.id;
            const pct = Math.min(
              100,
              Math.round(
                (entry.current_position / Math.max(1, entry.total_target)) * 100
              )
            );
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSelectedId(entry.id)}
                className={`flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 text-left transition active:scale-98 ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-500/10 text-zinc-900 dark:text-white'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'
                }`}
              >
                {entry.category === 'quran' ? (
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                ) : (
                  <BookOpen className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                )}
                <div className="max-w-[150px]">
                  <p className="truncate text-xs font-semibold">{entry.title}</p>
                  <p className="text-[10px] text-zinc-400">
                    {entry.current_position}/{entry.total_target} ({pct}%)
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Основная карточка активной книги / суры */}
      {isLoading ? (
        <div className="animate-pulse space-y-4 rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="h-6 w-40 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-8 w-3/4 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-3 w-full rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-28 w-full rounded-2xl bg-zinc-100 dark:bg-zinc-800/60" />
        </div>
      ) : activeItem ? (
        <ActiveReadingCard
          item={activeItem}
          userId={userId}
          isRealtimeConnected={isRealtimeConnected}
          onPatchItem={handlePatchItem}
        />
      ) : (
        <div className="rounded-3xl border border-dashed border-zinc-300 bg-white/60 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
          <BookOpen className="mx-auto h-8 w-8 text-zinc-400" />
          <p className="mt-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            В этом разделе пока нет активных записей
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Нажмите «Добавить» выше или напишите в Telegram-бота:
            <br />
            «Прочитал 45 страниц книги Атомные привычки»
          </p>
        </div>
      )}
    </div>
  );
}
