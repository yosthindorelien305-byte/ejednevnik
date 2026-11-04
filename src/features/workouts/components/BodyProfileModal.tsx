'use client';

import React, { useState, useEffect } from 'react';
import { X, UserCheck, Scale, Ruler, Timer, Sparkles, Check, Loader2 } from 'lucide-react';
import {
  type UserBodyProfile,
  calculateBmi,
  saveUserBodyProfile,
} from '../lib/bodyProfile';
import { hapticImpact, hapticNotification } from '@/lib/telegram/webapp';

interface BodyProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: UserBodyProfile;
  onSaved: (updated: UserBodyProfile) => void;
}

const PRESET_REST_OPTIONS = [45, 60, 90, 120, 180];

export function BodyProfileModal({
  isOpen,
  onClose,
  currentProfile,
  onSaved,
}: BodyProfileModalProps) {
  const [weightKg, setWeightKg] = useState<string>('75');
  const [heightCm, setHeightCm] = useState<string>('178');
  const [defaultRestSeconds, setDefaultRestSeconds] = useState<number>(90);
  const [customRestInput, setCustomRestInput] = useState<string>('90');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Синхронизируем инпуты при каждом открытии модалки или обновлении профиля
  useEffect(() => {
    if (isOpen) {
      setWeightKg(currentProfile.weightKg ? String(currentProfile.weightKg) : '75');
      setHeightCm(currentProfile.heightCm ? String(currentProfile.heightCm) : '178');
      const rest = currentProfile.defaultRestSeconds || 90;
      setDefaultRestSeconds(rest);
      setCustomRestInput(String(rest));
    }
  }, [isOpen, currentProfile]);

  if (!isOpen) return null;

  const wNum = parseFloat(weightKg) || 0;
  const hNum = parseFloat(heightCm) || 0;
  const bmiInfo = calculateBmi(wNum, hNum);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    hapticImpact('medium');
    setIsSaving(true);

    try {
      const rest = Math.max(10, parseInt(customRestInput) || defaultRestSeconds || 90);
      const updated: UserBodyProfile = {
        weightKg: Math.max(30, Math.min(250, wNum || 75)),
        heightCm: Math.max(100, Math.min(250, hNum || 178)),
        defaultRestSeconds: rest,
      };

      const saved = await saveUserBodyProfile(updated);
      hapticNotification('success');
      onSaved(saved);
      onClose();
    } catch (err) {
      console.error('[BodyProfileModal handleSave error]:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#16161C] p-6 shadow-2xl shadow-black/80">
        {/* Декоративное фоновое свечение в стиле Cyber Lime */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full bg-[#C4F124]/10 blur-2xl"
        />

        {/* Заголовок */}
        <div className="relative flex items-center justify-between pb-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#C4F124]/15 text-[#C4F124] ring-1 ring-[#C4F124]/25">
              <UserCheck className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-black tracking-wider text-white uppercase">
                Параметры тела & Supabase
              </h3>
              <p className="text-[11px] text-[#8F90A6]">
                Синхронизируются с базой данных профиля
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => {
              hapticImpact('light');
              onClose();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-[#8F90A6] hover:text-white disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          {/* Поля: Вес и Рост */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-[#8F90A6] uppercase">
                <Scale className="h-3.5 w-3.5 text-[#C4F124]" />
                Вес тела (кг)
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="30"
                max="250"
                required
                disabled={isSaving}
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="75.0"
                className="w-full rounded-2xl border border-white/10 bg-[#101014] px-3.5 py-2.5 text-center font-mono text-base font-black text-[#C4F124] tabular-nums focus:border-[#C4F124] focus:outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-[#8F90A6] uppercase">
                <Ruler className="h-3.5 w-3.5 text-[#C4F124]" />
                Рост (см)
              </label>
              <input
                type="number"
                inputMode="numeric"
                step="1"
                min="100"
                max="250"
                required
                disabled={isSaving}
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="178"
                className="w-full rounded-2xl border border-white/10 bg-[#101014] px-3.5 py-2.5 text-center font-mono text-base font-black text-white tabular-nums focus:border-[#C4F124] focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>

          {/* Карточка расчета ИМТ */}
          {bmiInfo.bmi > 0 && (
            <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#101014] px-4 py-2.5">
              <span className="text-[11px] font-bold text-[#8F90A6] uppercase">
                Индекс массы тела (ИМТ):
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-sm font-black text-white tabular-nums">
                  {bmiInfo.bmi}
                </span>
                <span className={`text-[11px] font-bold ${bmiInfo.colorClass}`}>
                  ({bmiInfo.label})
                </span>
              </div>
            </div>
          )}

          {/* Настройка таймера отдыха по умолчанию */}
          <div className="space-y-2 pt-2 border-t border-white/5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#8F90A6] uppercase">
                <Timer className="h-3.5 w-3.5 text-[#8A4FFF]" />
                Таймер отдыха по умолчанию
              </label>
              <span className="font-mono text-xs font-black text-[#8A4FFF]">
                {customRestInput} сек ({Math.floor(parseInt(customRestInput || '0') / 60)}м {parseInt(customRestInput || '0') % 60}с)
              </span>
            </div>

            {/* Быстрые пресеты */}
            <div className="grid grid-cols-5 gap-1.5">
              {PRESET_REST_OPTIONS.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    hapticImpact('light');
                    setDefaultRestSeconds(sec);
                    setCustomRestInput(String(sec));
                  }}
                  className={`rounded-xl py-1.5 font-mono text-xs font-black transition active:scale-95 disabled:opacity-50 ${
                    parseInt(customRestInput) === sec
                      ? 'bg-[#C4F124] text-black shadow-md shadow-[#C4F124]/20'
                      : 'border border-white/5 bg-[#1C1C24] text-[#8F90A6] hover:text-white'
                  }`}
                >
                  {sec}с
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] text-[#8F90A6]">Или точное число секунд:</span>
              <input
                type="number"
                min="10"
                max="600"
                step="5"
                disabled={isSaving}
                value={customRestInput}
                onChange={(e) => {
                  setCustomRestInput(e.target.value);
                  setDefaultRestSeconds(parseInt(e.target.value) || 90);
                }}
                className="w-20 rounded-xl border border-white/10 bg-[#101014] px-2 py-1 text-center font-mono text-xs font-black text-[#C4F124] focus:border-[#C4F124] focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[#C4F124]/20 bg-[#C4F124]/5 p-3 text-[11px] text-[#8F90A6]">
            <p className="flex items-start gap-1.5">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#C4F124] mt-0.5" />
              <span>
                Параметры сохраняются в базу данных Supabase и локальный кэш. Они восстанавливаются на любом вашем устройстве.
              </span>
            </p>
          </div>

          {/* Кнопка сохранения */}
          <button
            type="submit"
            disabled={isSaving}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#C4F124] py-3.5 text-xs font-black tracking-wider text-black uppercase shadow-lg shadow-[#C4F124]/20 transition hover:bg-[#b0db1f] active:scale-[0.98] disabled:opacity-60"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-black" />
                <span>Сохранение в Supabase...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4 stroke-[3]" />
                <span>Сохранить параметры тела</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
