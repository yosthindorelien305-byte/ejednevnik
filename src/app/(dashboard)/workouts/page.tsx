'use client';

import React, { useState } from 'react';
import { WorkoutForm } from '@/features/workouts/components/WorkoutForm';
import { WorkoutHistory } from '@/features/workouts/components/WorkoutHistory';
import { Dumbbell, History, Plus } from 'lucide-react';
import { hapticImpact } from '@/lib/telegram/webapp';

export default function WorkoutsPage() {
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [historyRefreshKey, setHistoryRefreshKey] = useState<number>(0);

  const handleWorkoutSaved = () => {
    setHistoryRefreshKey((k) => k + 1);
    // Плавно переключаем на вкладку «История», чтобы пользователь сразу увидел сохраненную тренировку
    setTimeout(() => {
      setActiveTab('history');
    }, 1200);
  };

  return (
    <div className="space-y-4">
      <header className="px-1">
        <div className="flex items-center justify-between">
          <div>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F5BA42] px-2.5 py-0.5 text-[10px] font-black tracking-wider text-stone-950 uppercase">
              <Dumbbell className="h-3 w-3" />
              WORKOUT TRACKER
            </span>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-[#FAF7F5] uppercase">
              Тренировки
            </h1>
          </div>

          {/* Переключатель вкладок «Запись» / «История» */}
          <div className="inline-flex rounded-2xl border border-white/5 bg-[#1E1A18] p-1 shadow-inner">
            <button
              type="button"
              onClick={() => {
                hapticImpact('light');
                setActiveTab('create');
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                activeTab === 'create'
                  ? 'bg-[#F5BA42] text-stone-950 shadow-md shadow-[#F5BA42]/15'
                  : 'text-[#A8A199] hover:text-[#FAF7F5]'
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              Запись
            </button>
            <button
              type="button"
              onClick={() => {
                hapticImpact('light');
                setActiveTab('history');
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                activeTab === 'history'
                  ? 'bg-[#F5BA42] text-stone-950 shadow-md shadow-[#F5BA42]/15'
                  : 'text-[#A8A199] hover:text-[#FAF7F5]'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              История
            </button>
          </div>
        </div>
        <p className="mt-1 text-xs text-[#A8A199]">
          {activeTab === 'create'
            ? 'Добавляйте рабочие подходы, отслеживайте тоннаж и фото формы'
            : 'Все ранее сохраненные тренировки, упражнения и фото прогресса'}
        </p>
      </header>

      {activeTab === 'create' ? (
        <WorkoutForm onSubmitSuccess={handleWorkoutSaved} />
      ) : (
        <WorkoutHistory refreshTrigger={historyRefreshKey} />
      )}
    </div>
  );
}
