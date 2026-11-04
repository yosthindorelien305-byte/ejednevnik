'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Timer,
  Play,
  Pause,
  Sparkles,
  ChevronUp,
  ChevronDown,
  X,
} from 'lucide-react';
import { playRestTimerCompletedSound } from '../lib/timerSound';
import { hapticImpact, hapticNotification } from '@/lib/telegram/webapp';

export interface ActiveRestTimerState {
  isActive: boolean;
  totalSeconds: number;
  remainingSeconds: number;
  exerciseName?: string;
  setIndex?: number;
  isPaused: boolean;
  isFinished: boolean;
}

interface RestTimerBarProps {
  timerState: ActiveRestTimerState;
  onUpdateState: (newState: ActiveRestTimerState) => void;
  onStop: () => void;
}

export function RestTimerBar({
  timerState,
  onUpdateState,
  onStop,
}: RestTimerBarProps) {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const audioPlayedRef = useRef<boolean>(false);

  // Обработка тикания таймера
  useEffect(() => {
    if (!timerState.isActive || timerState.isPaused || timerState.isFinished) {
      return;
    }

    const interval = setInterval(() => {
      onUpdateState({
        ...timerState,
        remainingSeconds: Math.max(0, timerState.remainingSeconds - 1),
        isFinished: timerState.remainingSeconds - 1 <= 0,
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerState, onUpdateState]);

  // Срабатывание при завершении таймера
  useEffect(() => {
    if (timerState.isFinished && timerState.isActive && !audioPlayedRef.current) {
      audioPlayedRef.current = true;
      playRestTimerCompletedSound();
      hapticNotification('success');
      // Повторный тактильный сигнал через 350мс для заметности
      setTimeout(() => hapticNotification('success'), 400);
    } else if (!timerState.isFinished) {
      audioPlayedRef.current = false;
    }
  }, [timerState.isFinished, timerState.isActive]);

  if (!timerState.isActive) return null;

  const minutes = Math.floor(timerState.remainingSeconds / 60);
  const seconds = timerState.remainingSeconds % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const progressPercent =
    timerState.totalSeconds > 0
      ? Math.max(0, Math.min(100, (timerState.remainingSeconds / timerState.totalSeconds) * 100))
      : 0;

  const handleAdjustTime = (deltaSec: number) => {
    hapticImpact('light');
    const newRem = Math.max(0, timerState.remainingSeconds + deltaSec);
    const newTot = Math.max(newRem, timerState.totalSeconds + (deltaSec > 0 ? deltaSec : 0));
    onUpdateState({
      ...timerState,
      remainingSeconds: newRem,
      totalSeconds: newTot,
      isFinished: newRem <= 0,
    });
  };

  const handleTogglePause = () => {
    hapticImpact('medium');
    onUpdateState({
      ...timerState,
      isPaused: !timerState.isPaused,
    });
  };

  const handleClose = () => {
    hapticImpact('light');
    onStop();
  };

  // Компактный режим (пилюля)
  if (isMinimized) {
    return (
      <div className="fixed bottom-24 right-4 z-40 animate-in fade-in slide-in-from-bottom-2 duration-200">
        <button
          type="button"
          onClick={() => {
            hapticImpact('light');
            setIsMinimized(false);
          }}
          className={`flex items-center gap-2 rounded-full border px-4 py-2 shadow-2xl backdrop-blur-xl transition active:scale-95 ${
            timerState.isFinished
              ? 'border-[#C4F124] bg-[#C4F124] text-black font-black animate-bounce shadow-[#C4F124]/30'
              : 'border-[#C4F124]/40 bg-[#16161C]/95 text-white shadow-black/80'
          }`}
        >
          <Timer className={`h-4 w-4 ${timerState.isFinished ? 'text-black' : 'text-[#C4F124]'}`} />
          <span className="font-mono text-sm font-black tabular-nums">
            {timerState.isFinished ? 'ГОТОВО!' : timeFormatted}
          </span>
          <ChevronUp className="h-3.5 w-3.5 opacity-60" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 left-0 right-0 z-40 px-3 sm:px-6">
      <div
        className={`relative mx-auto max-w-md overflow-hidden rounded-3xl border shadow-2xl backdrop-blur-xl transition-all duration-300 ${
          timerState.isFinished
            ? 'border-[#C4F124] bg-[#16161C]/95 shadow-[#C4F124]/20 ring-2 ring-[#C4F124]/50 animate-pulse'
            : 'border-white/10 bg-[#16161C]/95 shadow-black/80'
        }`}
      >
        {/* Анимированная полоса прогресса сверху (градиент Cyber Lime -> Neon Purple) */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/5">
          <div
            className="h-full bg-gradient-to-r from-[#C4F124] via-[#8A4FFF] to-[#C4F124] transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            {/* Левая часть: таймер и статус */}
            <div className="flex items-center gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition ${
                  timerState.isFinished
                    ? 'bg-[#C4F124] text-black'
                    : 'bg-[#C4F124]/15 text-[#C4F124] ring-1 ring-[#C4F124]/30'
                }`}
              >
                {timerState.isFinished ? (
                  <Sparkles className="h-6 w-6 animate-spin text-black" />
                ) : (
                  <Timer className="h-6 w-6 text-[#C4F124]" />
                )}
              </div>

              <div>
                <div className="flex items-baseline gap-2">
                  <span
                    className={`font-mono text-2xl sm:text-3xl font-black tracking-tight tabular-nums ${
                      timerState.isFinished ? 'text-[#C4F124]' : 'text-white'
                    }`}
                  >
                    {timeFormatted}
                  </span>
                  {timerState.isPaused && (
                    <span className="rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-black text-amber-400 uppercase">
                      Пауза
                    </span>
                  )}
                  {timerState.isFinished && (
                    <span className="rounded-md bg-[#C4F124] px-1.5 py-0.5 text-[10px] font-black text-black uppercase">
                      Время вышло!
                    </span>
                  )}
                </div>
                <p className="line-clamp-1 text-[11px] font-medium text-[#8F90A6]">
                  {timerState.isFinished
                    ? 'Пора делать следующий подход 💪'
                    : timerState.exerciseName
                    ? `${timerState.exerciseName} · Сет #${(timerState.setIndex ?? 0) + 1}`
                    : 'Отдых между подходами'}
                </p>
              </div>
            </div>

            {/* Правая часть: кнопки действий */}
            <div className="flex items-center gap-1">
              {!timerState.isFinished ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleAdjustTime(-15)}
                    title="Минус 15 секунд"
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1C1C24] font-mono text-xs font-bold text-[#8F90A6] transition hover:bg-white/10 hover:text-white active:scale-95"
                  >
                    -15
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustTime(30)}
                    title="Плюс 30 секунд"
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1C1C24] font-mono text-xs font-black text-[#C4F124] transition hover:bg-[#C4F124]/20 active:scale-95"
                  >
                    +30
                  </button>
                  <button
                    type="button"
                    onClick={handleTogglePause}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#C4F124]/15 text-[#C4F124] transition hover:bg-[#C4F124]/25 active:scale-95"
                  >
                    {timerState.isPaused ? (
                      <Play className="h-4 w-4 fill-current" />
                    ) : (
                      <Pause className="h-4 w-4 fill-current" />
                    )}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-xl bg-[#C4F124] px-3 py-1.5 font-mono text-xs font-black text-black uppercase shadow-md shadow-[#C4F124]/25 transition hover:bg-[#b0db1f] active:scale-95"
                >
                  На подход!
                </button>
              )}

              {/* Кнопка сворачивания */}
              <button
                type="button"
                onClick={() => {
                  hapticImpact('light');
                  setIsMinimized(true);
                }}
                className="flex h-8 w-7 items-center justify-center rounded-xl text-[#8F90A6] hover:text-white"
                title="Свернуть"
              >
                <ChevronDown className="h-4 w-4" />
              </button>

              {/* Кнопка закрытия/сброса */}
              <button
                type="button"
                onClick={handleClose}
                className="flex h-8 w-7 items-center justify-center rounded-xl text-[#8F90A6] hover:text-rose-400"
                title="Закрыть таймер"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
