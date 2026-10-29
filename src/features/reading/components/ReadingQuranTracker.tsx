'use client';

import React, { useState } from 'react';
import {
  BookOpen,
  Sparkles,
  Camera,
  CheckCircle2,
  Bookmark,
  Image as ImageIcon,
} from 'lucide-react';
import {
  PageScreenshotModal,
  type ReadingModalMode,
  type ScreenshotUploadResult,
} from '@/features/reading/components/PageScreenshotModal';

export interface BookCardData {
  id: string;
  title: string;
  author: string;
  totalPages: number;
  currentPage: number;
  status: 'reading' | 'completed';
  lastQuote?: string;
}

export interface SavedScreenshotEntry {
  id: string;
  mode: ReadingModalMode;
  referenceLabel: string;
  materialUrl?: string;
  note: string;
  previewUrl: string;
  createdAt: string;
}

const TOTAL_MUSHAF_PAGES = 604;

export function ReadingQuranTracker() {
  // Прогресс чтения Корана (по стандартному мединскому мусхафу — 604 страницы)
  const [mushafPage, setMushafPage] = useState<number>(128);
  const [currentSurahLabel, setCurrentSurahLabel] = useState<string>(
    'Сура 6 «Аль-Анам»'
  );

  // Карточки книг с прогрессом чтения
  const [books, setBooks] = useState<BookCardData[]>([
    {
      id: 'book-1',
      title: 'Атомные привычки',
      author: 'Джеймс Клир',
      totalPages: 304,
      currentPage: 190,
      status: 'reading',
      lastQuote: 'Вы опускаетесь до уровня своих систем, а не поднимаетесь до уровня целей.',
    },
    {
      id: 'book-2',
      title: 'Чистая архитектура',
      author: 'Роберт Мартин',
      totalPages: 352,
      currentPage: 352,
      status: 'completed',
      lastQuote: 'Хорошая архитектура позволяет откладывать принятие инфраструктурных решений.',
    },
  ]);

  // Состояние модального окна быстрой загрузки скриншота страницы
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: ReadingModalMode;
    targetId?: string;
    targetTitle?: string;
    defaultPage?: number;
  }>({
    isOpen: false,
    mode: 'quran',
  });

  // Лента недавно прикрепленных скриншотов и заметок тадаббура
  const [savedScreenshots, setSavedScreenshots] = useState<
    SavedScreenshotEntry[]
  >([]);

  const quranPercent =
    Math.round((mushafPage / TOTAL_MUSHAF_PAGES) * 1000) / 10;
  const currentJuz = Math.min(30, Math.max(1, Math.ceil(mushafPage / 20)));

  // Обновление текущей страницы книги с автопереводом в статус «Завершено»
  const updateBookPage = (bookId: string, nextPage: number) => {
    setBooks((prev) =>
      prev.map((book) => {
        if (book.id !== bookId) return book;
        const clamped = Math.max(0, Math.min(book.totalPages, nextPage));
        return {
          ...book,
          currentPage: clamped,
          status: clamped >= book.totalPages ? 'completed' : 'reading',
        };
      })
    );
  };

  // Обработка загруженного через модальное окно скриншота страницы
  const handleScreenshotSaved = (result: ScreenshotUploadResult) => {
    if (result.mode === 'quran') {
      if (result.pageNumber) {
        setMushafPage(
          Math.max(1, Math.min(TOTAL_MUSHAF_PAGES, result.pageNumber))
        );
      }
      if (result.surahNumber) {
        setCurrentSurahLabel(
          `Сура ${result.surahNumber}${
            result.ayahRange ? `, аяты ${result.ayahRange}` : ''
          }`
        );
      }
    } else if (result.mode === 'book' && result.targetId && result.pageNumber) {
      updateBookPage(result.targetId, result.pageNumber);
    }

    const referenceLabel =
      result.mode === 'quran'
        ? `Коран · Сура ${result.surahNumber ?? '—'}${
            result.ayahRange ? `:${result.ayahRange}` : ''
          }${result.pageNumber ? ` (стр. ${result.pageNumber})` : ''}`
        : `${
            books.find((b) => b.id === result.targetId)?.title ?? 'Книга'
          }${result.pageNumber ? ` · стр. ${result.pageNumber}` : ''}`;

    setSavedScreenshots((prev) => [
      {
        id: `${Date.now()}`,
        mode: result.mode,
        referenceLabel,
        materialUrl: result.materialUrl || undefined,
        note: result.reflectionNote,
        previewUrl: result.previewUrl,
        createdAt: new Date().toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
      ...prev,
    ]);
  };

  return (
    <div className="space-y-5">
      {/* Карточка трекинга чтения Корана */}
      <section className="overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950 via-teal-950 to-zinc-900 p-4 text-white shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
              <Sparkles className="h-3 w-3" />
              Чтение Корана · Тадаббур
            </span>
            <h2 className="mt-2 text-lg font-bold">{currentSurahLabel}</h2>
            <p className="text-xs text-emerald-200/80">
              Джуз {currentJuz} из 30 · Страница {mushafPage} из{' '}
              {TOTAL_MUSHAF_PAGES}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setModalState({
                isOpen: true,
                mode: 'quran',
                targetTitle: `Мусхаф · Джуз ${currentJuz}`,
                defaultPage: mushafPage,
              })
            }
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-zinc-950 shadow-sm transition hover:bg-emerald-400 active:scale-95"
          >
            <Camera className="h-4 w-4" />
            Скриншот страницы
          </button>
        </div>

        {/* Прогресс-бар прочитанного по мусхафу */}
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="text-emerald-200/90">Прогресс хатма</span>
            <span className="font-bold text-emerald-300">{quranPercent}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              style={{ width: `${Math.min(100, quranPercent)}%` }}
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-300"
            />
          </div>
        </div>

        {/* Быстрые кнопки отметки прочитанных страниц за день */}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
          <span className="text-xs text-emerald-200/80">Отметить чтение:</span>
          <div className="flex gap-1.5">
            {[1, 2, 5].map((step) => (
              <button
                key={step}
                type="button"
                onClick={() =>
                  setMushafPage((p) => Math.min(TOTAL_MUSHAF_PAGES, p + step))
                }
                className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-white/20 active:scale-95"
              >
                +{step} стр.
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Карточки трекинга чтения книг */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <BookOpen className="h-4 w-4 text-emerald-500" />
            Мои книги
          </h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Активных: {books.filter((b) => b.status === 'reading').length}
          </span>
        </div>

        {books.map((book) => {
          const progressPct =
            Math.round((book.currentPage / book.totalPages) * 1000) / 10;
          const isCompleted = book.status === 'completed';

          return (
            <article
              key={book.id}
              className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {book.title}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        isCompleted
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                          : 'bg-sky-500/15 text-sky-700 dark:text-sky-400'
                      }`}
                    >
                      {isCompleted && <CheckCircle2 className="h-3 w-3" />}
                      {isCompleted ? 'Завершено' : 'Читаю'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {book.author}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setModalState({
                      isOpen: true,
                      mode: 'book',
                      targetId: book.id,
                      targetTitle: book.title,
                      defaultPage: book.currentPage,
                    })
                  }
                  className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-emerald-500 hover:text-emerald-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  <ImageIcon className="h-3.5 w-3.5 text-emerald-500" />
                  Скриншот
                </button>
              </div>

              {/* Прогресс-бар прочитанных страниц книги */}
              <div className="mt-3">
                <div className="mb-1 flex items-baseline justify-between text-xs">
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Стр.{' '}
                    <strong className="text-zinc-900 dark:text-zinc-100">
                      {book.currentPage}
                    </strong>{' '}
                    из {book.totalPages}
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {progressPct}%
                  </span>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    style={{ width: `${Math.min(100, progressPct)}%` }}
                    className={`h-full rounded-full transition-all duration-300 ${
                      isCompleted ? 'bg-emerald-500' : 'bg-sky-500'
                    }`}
                  />
                </div>
              </div>

              {book.lastQuote && (
                <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-zinc-50 p-2.5 text-xs italic text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
                  <Bookmark className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <span>«{book.lastQuote}»</span>
                </p>
              )}

              {/* Быстрое обновление текущей страницы */}
              {!isCompleted && (
                <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-2.5 dark:border-zinc-800">
                  <span className="text-[11px] text-zinc-400">
                    Быстрый прогресс:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        updateBookPage(book.id, book.currentPage + 10)
                      }
                      className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 active:scale-95 dark:bg-zinc-800 dark:text-zinc-200"
                    >
                      +10 стр.
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateBookPage(book.id, book.currentPage + 25)
                      }
                      className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/25 active:scale-95 dark:text-emerald-400"
                    >
                      +25 стр.
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </section>

      {/* Галерея загруженных за сессию скриншотов страниц и тадаббура */}
      {savedScreenshots.length > 0 && (
        <section className="space-y-2.5">
          <h3 className="px-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            Сохраненные страницы и размышления
          </h3>
          <div className="space-y-2.5">
            {savedScreenshots.map((entry) => (
              <div
                key={entry.id}
                className="flex gap-3 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={entry.previewUrl}
                  alt={entry.referenceLabel}
                  className="h-20 w-16 shrink-0 rounded-xl border border-zinc-200 object-cover dark:border-zinc-700"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {entry.referenceLabel}
                    </span>
                    <span className="shrink-0 text-[10px] text-zinc-400">
                      {entry.createdAt}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-700 dark:text-zinc-300">
                    {entry.note || 'Скриншот страницы сохранен без текстовой заметки.'}
                  </p>
                  {entry.materialUrl && (
                    <a
                      href={entry.materialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-[11px] font-medium text-emerald-600 underline dark:text-emerald-400"
                    >
                      Открыть прикрепленный материал →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Модальное окно быстрой загрузки скриншота */}
      <PageScreenshotModal
        isOpen={modalState.isOpen}
        mode={modalState.mode}
        targetId={modalState.targetId}
        targetTitle={modalState.targetTitle}
        defaultPage={modalState.defaultPage}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        onSubmit={handleScreenshotSaved}
      />
    </div>
  );
}
