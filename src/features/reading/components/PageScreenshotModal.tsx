'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, UploadCloud, BookOpen, Sparkles } from 'lucide-react';

export type ReadingModalMode = 'quran' | 'book';

export interface ScreenshotUploadResult {
  mode: ReadingModalMode;
  targetId?: string;
  file: File;
  previewUrl: string;
  pageNumber: number | null;
  surahNumber: number | null;
  ayahRange: string;
  materialUrl: string;
  reflectionNote: string; // Поле тадаббура для Корана или заметки/цитаты для книги
}

interface PageScreenshotModalProps {
  isOpen: boolean;
  mode: ReadingModalMode;
  targetTitle?: string;
  targetId?: string;
  defaultPage?: number;
  onClose: () => void;
  onSubmit: (data: ScreenshotUploadResult) => Promise<void> | void;
}

export function PageScreenshotModal({
  isOpen,
  mode,
  targetTitle,
  targetId,
  defaultPage,
  onClose,
  onSubmit,
}: PageScreenshotModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState<string>(
    defaultPage ? String(defaultPage) : ''
  );
  const [surahNumber, setSurahNumber] = useState<string>('2');
  const [ayahRange, setAyahRange] = useState<string>('1-5');
  const [materialUrl, setMaterialUrl] = useState<string>('');
  const [reflectionNote, setReflectionNote] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (defaultPage) {
      setPageNumber(String(defaultPage));
    }
  }, [defaultPage, isOpen]);

  // Закрытие модального окна по клавише Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const applyFile = (file: File) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) applyFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      applyFile(file);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !previewUrl) return;

    await onSubmit({
      mode,
      targetId,
      file: selectedFile,
      previewUrl,
      pageNumber: pageNumber ? Number(pageNumber) : null,
      surahNumber: mode === 'quran' && surahNumber ? Number(surahNumber) : null,
      ayahRange: mode === 'quran' ? ayahRange.trim() : '',
      materialUrl: materialUrl.trim(),
      reflectionNote: reflectionNote.trim(),
    });

    // Передаем владение previewUrl родительской карточке для отображения в ленте
    setSelectedFile(null);
    setPreviewUrl(null);
    setMaterialUrl('');
    setReflectionNote('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="screenshot-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-zinc-200 bg-white p-5 shadow-2xl sm:rounded-3xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              {mode === 'quran' ? (
                <Sparkles className="h-5 w-5" />
              ) : (
                <BookOpen className="h-5 w-5" />
              )}
            </span>
            <div>
              <h3
                id="screenshot-modal-title"
                className="text-sm font-bold text-zinc-900 dark:text-zinc-100"
              >
                {mode === 'quran'
                  ? 'Скриншот страницы Корана'
                  : 'Скриншот страницы книги'}
              </h3>
              {targetTitle && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {targetTitle}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно"
            className="rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="mt-4 space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Зона загрузки и предпросмотра скриншота страницы */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed transition ${
              isDragging
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-zinc-300 bg-zinc-50 hover:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800/50'
            }`}
          >
            {previewUrl ? (
              <div className="relative aspect-[4/3] w-full bg-zinc-950">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Предпросмотр страницы"
                  className="h-full w-full object-contain"
                />
                <span className="absolute right-2 bottom-2 rounded-lg bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white">
                  Нажмите, чтобы заменить
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-center">
                <UploadCloud className="h-8 w-8 text-emerald-500" />
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                  Нажмите для выбора скриншота или перетащите файл
                </p>
                <p className="text-[11px] text-zinc-400">
                  Поддерживаются PNG, JPEG, WebP до 10 МБ
                </p>
              </div>
            )}
          </div>

          {/* Поля привязки: Сура / Аяты / Страница */}
          {mode === 'quran' ? (
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-500">
                  Сура (1–114)
                </label>
                <input
                  type="number"
                  min={1}
                  max={114}
                  value={surahNumber}
                  onChange={(e) => setSurahNumber(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-500">
                  Аяты
                </label>
                <input
                  type="text"
                  placeholder="1-10"
                  value={ayahRange}
                  onChange={(e) => setAyahRange(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-500">
                  Стр. (1–604)
                </label>
                <input
                  type="number"
                  min={1}
                  max={604}
                  value={pageNumber}
                  onChange={(e) => setPageNumber(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Номер страницы книги
              </label>
              <input
                type="number"
                min={1}
                placeholder="Например: 142"
                value={pageNumber}
                onChange={(e) => setPageNumber(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          )}

          {/* Ссылка на внешний материал (тафсир, аудиочтение, конспект) */}
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Ссылка на материал (тафсир, аудио, конспект)
            </label>
            <input
              type="url"
              placeholder="https://..."
              value={materialUrl}
              onChange={(e) => setMaterialUrl(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          {/* Поле для размышлений (тадаббур) или цитаты */}
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              {mode === 'quran'
                ? 'Размышления над аятами (Тадаббур)'
                : 'Ключевая мысль / цитата со страницы'}
            </label>
            <textarea
              rows={3}
              placeholder={
                mode === 'quran'
                  ? 'Запишите смыслы, выводы для практики и дуа по прочитанным аятам...'
                  : 'Запишите важную цитату или инсайт...'
              }
              value={reflectionNote}
              onChange={(e) => setReflectionNote(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 rounded-2xl border border-zinc-200 py-3 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!selectedFile}
              className="w-2/3 rounded-2xl bg-emerald-600 py-3 text-xs font-semibold text-white transition hover:bg-emerald-500 active:scale-98 disabled:opacity-45"
            >
              Сохранить скриншот
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
