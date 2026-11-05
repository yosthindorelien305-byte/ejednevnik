'use client';

import React from 'react';
import { Target } from 'lucide-react';
import { type WorkoutSplitKey, WORKOUT_SPLIT_PRESETS } from '../lib/workoutPresets';

interface MuscleFocusChartProps {
  activeSplit?: WorkoutSplitKey;
}

export function MuscleFocusChart({ activeSplit = 'push' }: MuscleFocusChartProps) {
  const preset = WORKOUT_SPLIT_PRESETS[activeSplit] || WORKOUT_SPLIT_PRESETS.push;
  const focusItems = preset.muscleFocus;

  // Расчет сегментов кольцевой диаграммы (SVG stroke-dasharray)
  const total = focusItems.reduce((acc, item) => acc + item.percentage, 0);
  const circumference = 2 * Math.PI * 34; // r = 34 => ~213.6

  let accumulatedPercent = 0;

  return (
    <div className="rounded-3xl border border-white/5 bg-[#16161C] p-4.5 shadow-xl shadow-black/60">
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#C4F124]/15 text-[#C4F124]">
            <Target className="h-3.5 w-3.5" />
          </span>
          <span className="text-[11px] font-black uppercase tracking-wider text-white">
            Muscle Focus (Фокус нагрузки)
          </span>
        </div>
        <span className="font-mono text-xs font-bold text-[#C4F124]">
          {preset.label}
        </span>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-5">
        {/* Кольцевая SVG-диаграмма */}
        <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
          <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 80 80">
            {/* Базовая подложка */}
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke="#1C1C24"
              strokeWidth="6.5"
            />

            {focusItems.map((item, idx) => {
              const dashLength = (item.percentage / total) * circumference;
              const strokeOffset = -((accumulatedPercent / total) * circumference);
              accumulatedPercent += item.percentage;

              return (
                <circle
                  key={idx}
                  cx="40"
                  cy="40"
                  r="34"
                  fill="none"
                  stroke={item.color}
                  strokeWidth="6.5"
                  strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                  strokeDashoffset={strokeOffset}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              );
            })}
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-mono text-xs font-black text-white">
              {preset.label}
            </span>
            <span className="text-[9px] font-bold text-[#8F90A6]">
              100%
            </span>
          </div>
        </div>

        {/* Легенда с точками и процентами */}
        <div className="flex w-full flex-col gap-2">
          {focusItems.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded-xl border border-white/5 bg-[#101014] px-3 py-1.5"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs font-semibold text-white">
                  {item.muscle}
                </span>
              </div>
              <span
                className="font-mono text-xs font-black tabular-nums"
                style={{ color: item.color }}
              >
                {item.percentage}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
