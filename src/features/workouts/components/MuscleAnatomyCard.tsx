'use client';

import React from 'react';
import { Play, Clock, Flame } from 'lucide-react';
import { type WorkoutSplitKey, WORKOUT_SPLIT_PRESETS } from '../lib/workoutPresets';
import { hapticImpact } from '@/lib/telegram/webapp';

interface MuscleAnatomyCardProps {
  activeSplit: WorkoutSplitKey;
  onApplyPreset?: () => void;
}

export function MuscleAnatomyCard({
  activeSplit,
  onApplyPreset,
}: MuscleAnatomyCardProps) {
  const preset = WORKOUT_SPLIT_PRESETS[activeSplit] || WORKOUT_SPLIT_PRESETS.push;

  // Определение подсветки мышечных зон в зависимости от активного сплита
  const isChestActive = activeSplit === 'push' || activeSplit === 'all';
  const isShouldersActive = activeSplit === 'push' || activeSplit === 'all';
  const isTricepsActive = activeSplit === 'push' || activeSplit === 'all';
  const isBackActive = activeSplit === 'pull' || activeSplit === 'all';
  const isBicepsActive = activeSplit === 'pull' || activeSplit === 'all';
  const isAbsActive = activeSplit === 'core' || activeSplit === 'all';
  const isLegsActive = activeSplit === 'legs' || activeSplit === 'all';

  const highlightFill = '#FF6D3B'; // Яркий неоново-оранжевый как на картинке
  const highlightGlow = 'drop-shadow(0 0 8px rgba(255, 109, 59, 0.8))';
  const limeHighlightGlow = 'drop-shadow(0 0 8px rgba(196, 241, 36, 0.8))';
  const baseFill = '#22222B'; // Темный матовый графит силуэта тела
  const strokeColor = '#32323E';

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-[#16161C] p-5 shadow-2xl shadow-black/80">
      {/* Фоновое неоновое свечение в углу */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-14 -right-14 h-48 w-48 rounded-full bg-[#C4F124]/10 blur-3xl"
      />

      <div className="relative flex items-center justify-between gap-4">
        {/* Левая часть: текстовая информация сплита */}
        <div className="flex-1 min-w-0">
          <span className="inline-block rounded-md bg-[#C4F124]/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#C4F124]">
            {activeSplit.toUpperCase()} SPLIT
          </span>

          <h2 className="mt-2 text-xl sm:text-2xl font-black uppercase tracking-tight text-white truncate">
            {preset.title.split('·')[0].trim()}
          </h2>

          <p className="mt-0.5 text-xs font-semibold text-[#8F90A6] truncate">
            {preset.subtitle}
          </p>

          {/* Метрики: время и калории с иконками */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-black text-white">
              <Clock className="h-3.5 w-3.5 text-[#8F90A6]" />
              {preset.estimatedMinutes} мин
            </span>

            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-black text-[#FF6D3B]">
              <Flame className="h-3.5 w-3.5 fill-current" />
              ~{preset.estimatedCalories} ккал
            </span>
          </div>

          <p className="mt-3 text-[11px] text-[#8F90A6]/80 line-clamp-1">
            Целевые мышцы: <strong className="text-white">{preset.targetMuscles.slice(0, 3).join(', ')}</strong>
          </p>
        </div>

        {/* Правая часть: анатомический силуэт манекена с подсветкой и круглой кнопкой Play */}
        <div className="relative flex shrink-0 flex-col items-center">
          <div className="relative h-36 w-32 flex items-center justify-center">
            {/* Векторная анатомическая модель торса */}
            <svg
              className="h-full w-full"
              viewBox="0 0 160 180"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Голова и шея */}
              <circle cx="80" cy="22" r="14" fill={baseFill} stroke={strokeColor} strokeWidth="1.5" />
              <path d="M73 34 L73 44 L87 44 L87 34 Z" fill={baseFill} />

              {/* Трапеции */}
              <path
                d="M66 44 L52 54 L60 62 L74 46 Z M94 44 L108 54 L100 62 L86 46 Z"
                fill={isBackActive ? highlightFill : baseFill}
                stroke={strokeColor}
                strokeWidth="1.5"
                style={isBackActive ? { filter: highlightGlow } : undefined}
                className="transition-all duration-300"
              />

              {/* Плечи (Дельтовидные мышцы) — светятся при Push */}
              {/* Левое плечо */}
              <path
                d="M48 54 C34 60 28 74 32 86 C36 94 44 94 48 84 C52 76 54 64 48 54 Z"
                fill={isShouldersActive ? highlightFill : baseFill}
                stroke={isShouldersActive ? '#FF925C' : strokeColor}
                strokeWidth="1.5"
                style={isShouldersActive ? { filter: highlightGlow } : undefined}
                className="transition-all duration-300"
              />
              {/* Правое плечо */}
              <path
                d="M112 54 C126 60 132 74 128 86 C124 94 116 94 112 84 C108 76 106 64 112 54 Z"
                fill={isShouldersActive ? highlightFill : baseFill}
                stroke={isShouldersActive ? '#FF925C' : strokeColor}
                strokeWidth="1.5"
                style={isShouldersActive ? { filter: highlightGlow } : undefined}
                className="transition-all duration-300"
              />

              {/* Грудные мышцы (Pectoralis) — светятся при Push */}
              {/* Левая грудная */}
              <path
                d="M52 64 C62 62 76 66 78 78 C76 90 62 94 52 88 C46 82 48 70 52 64 Z"
                fill={isChestActive ? highlightFill : baseFill}
                stroke={isChestActive ? '#FF925C' : strokeColor}
                strokeWidth="1.5"
                style={isChestActive ? { filter: highlightGlow } : undefined}
                className="transition-all duration-300"
              />
              {/* Правая грудная */}
              <path
                d="M108 64 C98 62 84 66 82 78 C84 90 98 94 108 88 C114 82 112 70 108 64 Z"
                fill={isChestActive ? highlightFill : baseFill}
                stroke={isChestActive ? '#FF925C' : strokeColor}
                strokeWidth="1.5"
                style={isChestActive ? { filter: highlightGlow } : undefined}
                className="transition-all duration-300"
              />

              {/* Руки: Бицепс (при Pull) / Трицепс (при Push) */}
              <path
                d="M28 86 C24 98 26 114 34 124 C38 120 42 110 40 96 Z"
                fill={isTricepsActive || isBicepsActive ? highlightFill : baseFill}
                stroke={strokeColor}
                strokeWidth="1.5"
                style={isTricepsActive || isBicepsActive ? { filter: highlightGlow } : undefined}
                className="transition-all duration-300"
              />
              <path
                d="M132 86 C136 98 134 114 126 124 C122 120 118 110 120 96 Z"
                fill={isTricepsActive || isBicepsActive ? highlightFill : baseFill}
                stroke={strokeColor}
                strokeWidth="1.5"
                style={isTricepsActive || isBicepsActive ? { filter: highlightGlow } : undefined}
                className="transition-all duration-300"
              />

              {/* Мышцы кора / Пресс (Abs) — светятся при Core */}
              {/* Верхний пресс */}
              <rect
                x="68"
                y="92"
                width="11"
                height="10"
                rx="2"
                fill={isAbsActive ? '#C4F124' : baseFill}
                stroke={isAbsActive ? '#C4F124' : strokeColor}
                strokeWidth="1.2"
                style={isAbsActive ? { filter: limeHighlightGlow } : undefined}
                className="transition-all duration-300"
              />
              <rect
                x="81"
                y="92"
                width="11"
                height="10"
                rx="2"
                fill={isAbsActive ? '#C4F124' : baseFill}
                stroke={isAbsActive ? '#C4F124' : strokeColor}
                strokeWidth="1.2"
                style={isAbsActive ? { filter: limeHighlightGlow } : undefined}
                className="transition-all duration-300"
              />
              {/* Средний пресс */}
              <rect
                x="68"
                y="105"
                width="11"
                height="10"
                rx="2"
                fill={isAbsActive ? '#C4F124' : baseFill}
                stroke={isAbsActive ? '#C4F124' : strokeColor}
                strokeWidth="1.2"
                style={isAbsActive ? { filter: limeHighlightGlow } : undefined}
                className="transition-all duration-300"
              />
              <rect
                x="81"
                y="105"
                width="11"
                height="10"
                rx="2"
                fill={isAbsActive ? '#C4F124' : baseFill}
                stroke={isAbsActive ? '#C4F124' : strokeColor}
                strokeWidth="1.2"
                style={isAbsActive ? { filter: limeHighlightGlow } : undefined}
                className="transition-all duration-300"
              />
              {/* Нижний пресс / поясница */}
              <path
                d="M68 118 L92 118 L80 134 Z"
                fill={isAbsActive ? '#C4F124' : baseFill}
                stroke={isAbsActive ? '#C4F124' : strokeColor}
                strokeWidth="1.2"
                style={isAbsActive ? { filter: limeHighlightGlow } : undefined}
                className="transition-all duration-300"
              />

              {/* Таз и Бедра (Ноги / Квадрицепсы) — светятся при Legs */}
              <path
                d="M58 132 C50 144 52 164 56 178 L74 178 C76 160 74 144 72 132 Z"
                fill={isLegsActive ? highlightFill : baseFill}
                stroke={isLegsActive ? '#FF925C' : strokeColor}
                strokeWidth="1.5"
                style={isLegsActive ? { filter: highlightGlow } : undefined}
                className="transition-all duration-300"
              />
              <path
                d="M102 132 C110 144 108 164 104 178 L86 178 C84 160 86 144 88 132 Z"
                fill={isLegsActive ? highlightFill : baseFill}
                stroke={isLegsActive ? '#FF925C' : strokeColor}
                strokeWidth="1.5"
                style={isLegsActive ? { filter: highlightGlow } : undefined}
                className="transition-all duration-300"
              />
            </svg>

            {/* Круглая кнопка Play как на Pinterest макете */}
            <button
              type="button"
              onClick={() => {
                hapticImpact('heavy');
                onApplyPreset?.();
              }}
              title="Загрузить упражнения сплита"
              className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full bg-[#C4F124] text-black shadow-lg shadow-[#C4F124]/30 transition-transform hover:scale-110 active:scale-95"
            >
              <Play className="h-4 w-4 fill-current ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
