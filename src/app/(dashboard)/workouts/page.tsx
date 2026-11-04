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
            <span className="inline-flex items-center gap-1 rounded-full bg-[#C4F124] px-2.5 py-0.5 text-[10px] font-black tracking-wider text-black uppercase">
              <Dumbbell className="h-3 w-3" />
              WORKOUT TRACKER
            </span>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-[#FFFFFF] uppercase">
              Тренировки
            </h1>
          </div>

          {/* Переключатель вкладок «Запись» / «История» в стиле Cyber Lime */}
          <div className="inline-flex rounded-2xl border border-white/5 bg-[#16161C] p-1 shadow-inner">
            <button
              type="button"
              onClick={() => {
                hapticImpact('light');
                setActiveTab('create');
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition active:scale-95 ${
                activeTab === 'create'
                  ? 'bg-[#C4F124] text-black shadow-md shadow-[#C4F124]/20'
                  : 'text-[#8F90A6] hover:text-[#FFFFFF]'
              }`}
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              Запись
            </button>
            <button
              type="button"
              onClick={() => {
                hapticImpact('light');
                setActiveTab('history');
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition active:scale-95 ${
                activeTab === 'history'
                  ? 'bg-[#C4F124] text-black shadow-md shadow-[#C4F124]/20'
                  : 'text-[#8F90A6] hover:text-[#FFFFFF]'
              }`}
            >
              <History className="h-3.5 w-3.5 stroke-[2.5]" />
              История
            </button>
          </div>
        </div>
        <p className="mt-1 text-xs text-[#8F90A6]">
          {activeTab === 'create'
            ? 'Добавляйте рабочие сеты, фиксируйте тоннаж и запускайте таймер отдыха'
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
