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
  Trash2,
  ExternalLink,
  ChevronRight,
  Library,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { hapticImpact, hapticNotification } from '@/lib/telegram/webapp';
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

const LOCAL_STORAGE_READING_KEY = 'ejednevnik_books_library_cache';

// Стартовые демонстрационные записи
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

function getLocalCachedBooks(): BooksAndQuranRow[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_READING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map(normalizeRow);
    }
  } catch {
    // ignore
  }
  return [];
}

function saveLocalCachedBooks(rows: BooksAndQuranRow[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_READING_KEY, JSON.stringify(rows));
  } catch {
    // ignore
  }
}

/**
 * Клиентский контроллер раздела «Книги и Коран»:
 * - Гарантирует постоянное сохранение всей библиотеки книг и сур (в Supabase + локальный кэш);
 * - Поддерживает Supabase Realtime (postgres_changes) для мгновенного обновления из бота;
 * - Отображает постоянную секцию «Моя библиотека» со всеми предыдущими книгами.
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

  // Форма добавления новой книги или суры
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false);
  const [newCategory, setNewCategory] = useState<ReadingCategory>('book');
  const [newTitle, setNewTitle] = useState<string>('');
  const [newTotalTarget, setNewTotalTarget] = useState<string>('300');
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Первичная подгрузка из localStorage при клиенте (чтобы никогда не терять книги)
  useEffect(() => {
    const cached = getLocalCachedBooks();
    if (cached.length > 0) {
      setItems((prev) => {
        const dbIds = new Set(prev.map((p) => p.id));
        const missing = cached.filter((c) => !dbIds.has(c.id));
        if (missing.length > 0) {
          return sortByUpdatedDesc([...prev, ...missing]);
        }
        return prev;
      });
    }
  }, []);

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
          // Объединяем с локальным кэшем
          const dbIds = new Set(normalized.map((r) => r.id));
          const localOffline = getLocalCachedBooks().filter(
            (r) => !dbIds.has(r.id) && !r.id.startsWith('demo-')
          );
          const merged = sortByUpdatedDesc([...normalized, ...localOffline]);

          setItems(merged);
          saveLocalCachedBooks(merged);

          setSelectedId((prevSelected) => {
            if (
              prevSelected &&
              merged.some((row) => row.id === prevSelected)
            ) {
              return prevSelected;
            }
            return merged[0]?.id ?? null;
          });
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [userId]
  );

  // Первичная подгрузка
  useEffect(() => {
    void fetchFreshItems(initialUserId, false);
  }, [fetchFreshItems, initialUserId]);

  // Live-подписка Supabase Realtime (postgres_changes)
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
              const next = sortByUpdatedDesc([inserted, ...withoutDup]);
              saveLocalCachedBooks(next);
              return next;
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
            setItems((prev) => {
              const next = sortByUpdatedDesc(
                prev.map((row) => (row.id === updated.id ? updated : row))
              );
              saveLocalCachedBooks(next);
              return next;
            });

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
              saveLocalCachedBooks(remaining);
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

  // Автоматическая ревалидация при возврате на вкладку
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

  // Отфильтрованный список записей
  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return items;
    return items.filter((item) => item.category === activeFilter);
  }, [items, activeFilter]);

  // Текущая активная книга / сура
  const activeItem = useMemo(() => {
    if (filteredItems.length === 0) return null;
    return (
      filteredItems.find((i) => i.id === selectedId) ?? filteredItems[0]
    );
  }, [filteredItems, selectedId]);

  // Патч полей карточки с записью в Supabase и локальный кэш
  const handlePatchItem = useCallback(
    async (
      itemId: string,
      patch: Partial<BooksAndQuranRow>
    ): Promise<boolean> => {
      const nowIso = new Date().toISOString();

      setItems((prev) => {
        const next = sortByUpdatedDesc(
          prev.map((row) =>
            row.id === itemId
              ? normalizeRow({ ...row, ...patch, updated_at: nowIso })
              : row
          )
        );
        saveLocalCachedBooks(next);
        return next;
      });

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
        await fetchFreshItems(userId, true);
        return false;
      }

      return true;
    },
    [userId, fetchFreshItems]
  );

  // Удаление книги из библиотеки
  const handleDeleteItem = async (itemId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    hapticImpact('medium');
    if (!confirm('Удалить эту запись из библиотеки?')) return;

    setItems((prev) => {
      const remaining = prev.filter((r) => r.id !== itemId);
      saveLocalCachedBooks(remaining);
      setSelectedId((curr) => (curr === itemId ? remaining[0]?.id ?? null : curr));
      return remaining;
    });

    const supabase = getSupabaseBrowserClient();
    if (supabase && userId && !itemId.startsWith('demo-')) {
      await supabase.from('books_and_quran').delete().eq('id', itemId).eq('user_id', userId);
    }
  };

  // Автоподстановка числа аятов при вводе номера суры
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
    hapticImpact('medium');
    const trimmedTitle = newTitle.trim();
    const parsedTotal = Math.max(1, parseInt(newTotalTarget, 10) || 300);
    if (!trimmedTitle) return;

    setIsCreating(true);
    const supabase = getSupabaseBrowserClient();

    try {
      let currentUid = userId;
      if (!currentUid && supabase) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          currentUid = user.id;
          setUserId(user.id);
        }
      }

      if (supabase && currentUid) {
        const { data, error } = await supabase
          .from('books_and_quran')
          .insert({
            user_id: currentUid,
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
          setItems((prev) => {
            const next = sortByUpdatedDesc([
              created,
              ...prev.filter((r) => r.id !== created.id),
            ]);
            saveLocalCachedBooks(next);
            return next;
          });
          setSelectedId(created.id);
          hapticNotification('success');

          // Уведомление в Telegram-бот
          void fetch('/api/telegram/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'reading',
              userId: currentUid,
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
          id: `local-${crypto.randomUUID()}`,
          user_id: 'local-user',
          category: newCategory,
          title: trimmedTitle,
          current_position: 0,
          total_target: parsedTotal,
          last_updated_by: 'web',
        });
        setItems((prev) => {
          const next = [localItem, ...prev];
          saveLocalCachedBooks(next);
          return next;
        });
        setSelectedId(localItem.id);
        hapticNotification('success');
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
          className="flex items-center justify-between gap-2 rounded-2xl border border-[#F5BA42]/30 bg-[#F5BA42]/10 px-4 py-2.5 text-xs font-bold text-[#F5BA42] shadow-lg shadow-black/40"
        >
          <span className="flex items-center gap-2">
            <Send className="h-3.5 w-3.5 shrink-0 text-[#F5BA42]" />
            {liveToast}
          </span>
          <button
            type="button"
            onClick={() => setLiveToast(null)}
            className="rounded-lg p-0.5 text-[#F5BA42] hover:bg-[#F5BA42]/20"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Панель фильтров и действий в стиле FitFusion Dark Luxury */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-2xl border border-white/5 bg-[#1E1A18] p-1 shadow-inner">
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
                onClick={() => {
                  hapticImpact('light');
                  setActiveFilter(tab.id);
                }}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                  active
                    ? 'bg-[#F5BA42] text-stone-950 shadow-md shadow-[#F5BA42]/15'
                    : 'text-[#A8A199] hover:text-[#FAF7F5]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase ${
              isRealtimeConnected
                ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30'
                : 'bg-white/5 text-[#A8A199]'
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
                {userId ? 'В сети' : 'Оффлайн'}
              </>
            )}
          </span>

          <button
            type="button"
            onClick={() => {
              hapticImpact('light');
              void fetchFreshItems(userId, false);
            }}
            aria-label="Синхронизировать с базой"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/5 bg-[#1E1A18] text-[#A8A199] transition hover:text-[#F5BA42] active:scale-95"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-[#F5BA42]' : ''}`}
            />
          </button>

          <button
            type="button"
            onClick={() => {
              hapticImpact('medium');
              setIsAddOpen((v) => !v);
            }}
            className="inline-flex items-center gap-1 rounded-xl bg-[#F5BA42] px-3 py-1.5 text-xs font-bold text-stone-950 shadow-md shadow-[#F5BA42]/15 transition hover:bg-[#e5aa32] active:scale-95"
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
          className="space-y-3.5 rounded-3xl border border-white/5 bg-[#24201E] p-5 shadow-2xl shadow-black/50"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black tracking-wider text-[#FAF7F5] uppercase">
              Добавить книгу или суру Корана
            </h3>
            <div className="inline-flex rounded-xl bg-[#141211] p-0.5 ring-1 ring-white/5">
              <button
                type="button"
                onClick={() => {
                  hapticImpact('light');
                  setNewCategory('book');
                  setNewTotalTarget('300');
                }}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                  newCategory === 'book'
                    ? 'bg-[#F5BA42] text-stone-950'
                    : 'text-[#A8A199]'
                }`}
              >
                📖 Книга
              </button>
              <button
                type="button"
                onClick={() => {
                  hapticImpact('light');
                  setNewCategory('quran');
                  setNewTotalTarget('286');
                }}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                  newCategory === 'quran'
                    ? 'bg-[#5B1626] text-[#F5BA42]'
                    : 'text-[#A8A199]'
                }`}
              >
                🕋 Коран
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
                  ? 'Например: Сура 18 «Аль-Кахф»'
                  : 'Например: Атомные привычки'
              }
              className="rounded-2xl border border-white/10 bg-[#1A1615] px-3.5 py-2.5 text-sm text-[#FAF7F5] placeholder:text-stone-500 focus:border-[#F5BA42] focus:outline-none sm:col-span-2"
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
              className="rounded-2xl border border-white/10 bg-[#1A1615] px-3.5 py-2.5 font-mono text-sm font-bold text-[#FAF7F5] placeholder:text-stone-500 tabular-nums focus:border-[#F5BA42] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="rounded-xl px-3 py-2 text-xs font-bold text-[#A8A199] hover:text-[#FAF7F5]"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isCreating || !newTitle.trim()}
              className="rounded-xl bg-[#F5BA42] px-4 py-2 text-xs font-bold text-stone-950 shadow-md shadow-[#F5BA42]/15 hover:bg-[#e5aa32] disabled:opacity-50 active:scale-95"
            >
              {isCreating ? 'Сохранение...' : 'Создать и сохранить'}
            </button>
          </div>
        </form>
      )}

      {/* Быстрый горизонтальный свитчер книг */}
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
                onClick={() => {
                  hapticImpact('light');
                  setSelectedId(entry.id);
                }}
                className={`flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 text-left transition active:scale-98 ${
                  isSelected
                    ? 'border-[#F5BA42] bg-[#F5BA42]/10 text-[#FAF7F5]'
                    : 'border-white/5 bg-[#1E1A18] text-[#A8A199] hover:border-[#F5BA42]/30'
                }`}
              >
                {entry.category === 'quran' ? (
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#F5BA42]" />
                ) : (
                  <BookOpen className="h-3.5 w-3.5 shrink-0 text-[#F5BA42]" />
                )}
                <div className="max-w-[150px]">
                  <p className="truncate text-xs font-bold text-[#FAF7F5]">{entry.title}</p>
                  <p className="font-mono text-[10px] text-[#A8A199] tabular-nums">
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
        <div className="animate-pulse space-y-4 rounded-3xl border border-white/5 bg-[#24201E] p-5 shadow-2xl">
          <div className="h-6 w-32 rounded-lg bg-[#1A1615]" />
          <div className="h-8 w-3/4 rounded-lg bg-[#1A1615]" />
          <div className="h-2 w-full rounded-full bg-[#1A1615]" />
          <div className="h-32 w-full rounded-2xl bg-[#1A1615]" />
        </div>
      ) : activeItem ? (
        <ActiveReadingCard
          item={activeItem}
          userId={userId}
          isRealtimeConnected={isRealtimeConnected}
          onPatchItem={handlePatchItem}
        />
      ) : (
        <div className="rounded-3xl border border-dashed border-white/10 bg-[#1E1A18]/60 p-8 text-center shadow-xl">
          <BookOpen className="mx-auto h-8 w-8 text-[#A8A199]" />
          <p className="mt-2 text-sm font-bold text-[#FAF7F5]">
            В этом разделе пока нет книг
          </p>
          <p className="mt-1 text-xs text-[#A8A199]">
            Нажмите «Добавить» выше или напишите в Telegram-бота:
            <br />
            «Прочитал 45 страниц книги Атомные привычки»
          </p>
        </div>
      )}

      {/* ПОСТОЯННЫЙ БЛОК: «МОЯ БИБЛИОТЕКА» — ВСЕ СОХРАНЕННЫЕ КНИГИ И СУРЫ */}
      <section className="pt-4 space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center rounded-lg bg-[#F5BA42]/10 p-1 text-[#F5BA42]">
              <Library className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-black tracking-tight text-[#FAF7F5] uppercase">
              Моя библиотека
            </h3>
            <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-[10px] font-bold text-[#A8A199] tabular-nums">
              {filteredItems.length}
            </span>
          </div>
          <span className="text-[11px] text-[#A8A199]">
            Сохраняются навсегда
          </span>
        </div>

        {filteredItems.length === 0 ? (
          <p className="px-1 text-xs text-[#A8A199]">Нет сохраненных книг</p>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {filteredItems.map((b) => {
              const isSelected = activeItem?.id === b.id;
              const isQuran = b.category === 'quran';
              const safeTarget = Math.max(1, b.total_target);
              const pct = Math.min(100, Math.round((b.current_position / safeTarget) * 100));

              return (
                <div
                  key={b.id}
                  onClick={() => {
                    hapticImpact('light');
                    setSelectedId(b.id);
                  }}
                  className={`group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-3xl border p-4 transition active:scale-[0.99] ${
                    isSelected
                      ? 'border-[#F5BA42] bg-gradient-to-br from-[#292321] to-[#1E1A18] shadow-xl shadow-black/60'
                      : 'border-white/5 bg-[#24201E] hover:border-white/10'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                          isQuran
                            ? 'bg-[#5B1626] text-[#F5BA42]'
                            : 'bg-[#F5BA42] text-stone-950'
                        }`}
                      >
                        {isQuran ? (
                          <Sparkles className="h-2.5 w-2.5" />
                        ) : (
                          <BookOpen className="h-2.5 w-2.5" />
                        )}
                        {isQuran ? 'Коран' : 'Книга'}
                      </span>

                      <div className="flex items-center gap-1">
                        {isSelected && (
                          <span className="inline-flex items-center rounded-full bg-[#F5BA42]/15 px-2 py-0.5 text-[9px] font-bold text-[#F5BA42]">
                            Активна
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteItem(b.id, e)}
                          title="Удалить"
                          className="rounded-lg p-1 text-stone-500 opacity-60 transition hover:bg-rose-500/15 hover:text-rose-400 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <h4 className="mt-2.5 truncate text-sm font-black text-[#FAF7F5] uppercase">
                      {b.title}
                    </h4>

                    {b.notes && (
                      <p className="mt-1 line-clamp-2 text-xs text-[#A8A199]/80 italic">
                        «{b.notes}»
                      </p>
                    )}
                  </div>

                  <div className="mt-3.5">
                    <div className="flex items-center justify-between text-xs text-[#A8A199]">
                      <span className="font-mono tabular-nums">
                        {b.current_position} / {b.total_target} {isQuran ? 'аятов' : 'стр.'}
                      </span>
                      <span className="font-mono font-bold text-[#F5BA42] tabular-nums">
                        {pct}%
                      </span>
                    </div>

                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#141211]">
                      <div
                        style={{ width: `${pct}%` }}
                        className="h-full rounded-full bg-[#F5BA42] transition-all"
                      />
                    </div>

                    <div className="mt-2.5 flex items-center justify-between pt-1">
                      <span className="text-[10px] text-[#A8A199]">
                        {b.media_urls.length > 0 && `📸 ${b.media_urls.length} скринш. · `}
                        {b.resource_urls.length > 0 && `🔗 ${b.resource_urls.length} ссылок`}
                      </span>

                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F5BA42] group-hover:translate-x-0.5 transition-transform">
                        {isSelected ? 'Открыта выше' : 'Читать'}
                        <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}