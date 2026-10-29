'use client';

import React, { useEffect, useRef } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';

export interface SelectedPhotoItem {
  id: string;
  file: File;
  previewUrl: string;
  caption: string;
}

interface IosPhotoUploaderProps {
  photos: SelectedPhotoItem[];
  onChange: (nextPhotos: SelectedPhotoItem[]) => void;
  multiple?: boolean;
  label?: string;
  hint?: string;
  showCaptionInput?: boolean;
}

const makeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);

/**
 * Нативный загрузчик фото для iPhone (iOS Safari / Standalone PWA):
 * - <input type="file" accept="image/*" /> вызывает системное меню iOS («Медиатека / Снять фото / Файлы»);
 * - Кнопка «Камера» с capture="environment" мгновенно открывает объектив iPhone;
 * - Обеспечивает мгновенный предпросмотр перед отправкой в Supabase Storage и очищает Object URL.
 */
export function IosPhotoUploader({
  photos,
  onChange,
  multiple = false,
  label = 'Фото с камеры или галереи iPhone',
  hint = 'Мгновенный предпросмотр перед сохранением в базу',
  showCaptionInput = true,
}: IosPhotoUploaderProps) {
  const galleryOrSheetRef = useRef<HTMLInputElement | null>(null);
  const directCameraRef = useRef<HTMLInputElement | null>(null);
  const latestPhotosRef = useRef<SelectedPhotoItem[]>(photos);

  useEffect(() => {
    latestPhotosRef.current = photos;
  }, [photos]);

  // Освобождаем память браузера при размонтировании компонента
  useEffect(() => {
    return () => {
      latestPhotosRef.current.forEach((item) =>
        URL.revokeObjectURL(item.previewUrl)
      );
    };
  }, []);

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const incoming: SelectedPhotoItem[] = Array.from(fileList).map((file) => ({
      id: makeId(),
      file,
      previewUrl: URL.createObjectURL(file),
      caption: '',
    }));

    if (multiple) {
      onChange([...photos, ...incoming]);
    } else {
      // В одиночном режиме очищаем предыдущий превью-URL перед заменой
      photos.forEach((old) => URL.revokeObjectURL(old.previewUrl));
      onChange([incoming[0]]);
    }

    e.target.value = '';
  };

  const handleRemove = (id: string) => {
    const target = photos.find((p) => p.id === id);
    if (target) {
      URL.revokeObjectURL(target.previewUrl);
    }
    onChange(photos.filter((p) => p.id !== id));
  };

  const handleCaptionChange = (id: string, caption: string) => {
    onChange(
      photos.map((p) => (p.id === id ? { ...p, caption } : p))
    );
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {label}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
      </div>

      {/* Нативный инпут iOS: открывает выбор «Медиатека / Снять фото / Выбрать файл» */}
      <input
        ref={galleryOrSheetRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        onChange={handleFilesSelected}
        className="hidden"
      />

      {/* Прямой вызов задней камеры iPhone в 1 тап */}
      <input
        ref={directCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFilesSelected}
        className="hidden"
      />

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => directCameraRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-3 py-3 text-xs font-semibold text-white shadow-xs transition active:scale-97"
        >
          <Camera className="h-4 w-4 shrink-0" />
          Снять на камеру
        </button>

        <button
          type="button"
          onClick={() => galleryOrSheetRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-100 px-3 py-3 text-xs font-semibold text-zinc-800 transition active:scale-97 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
        >
          <ImagePlus className="h-4 w-4 shrink-0 text-emerald-500" />
          Из медиатеки iOS
        </button>
      </div>

      {/* Карточки мгновенного предпросмотра перед сохранением в БД */}
      {photos.length > 0 && (
        <div
          className={
            multiple ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-1 gap-3'
          }
        >
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div
                className={`relative w-full bg-zinc-950 ${
                  multiple ? 'aspect-[3/4]' : 'aspect-[4/3]'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.previewUrl}
                  alt="Предпросмотр выбранного фото"
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemove(photo.id)}
                  aria-label="Удалить снимок"
                  className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-md transition active:scale-90"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {showCaptionInput && (
                <input
                  type="text"
                  placeholder="Подпись к снимку..."
                  value={photo.caption}
                  onChange={(e) =>
                    handleCaptionChange(photo.id, e.target.value)
                  }
                  className="w-full border-t border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
