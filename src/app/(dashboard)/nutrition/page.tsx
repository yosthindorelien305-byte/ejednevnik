import { Utensils } from 'lucide-react';
import { NutritionTracker } from '@/features/nutrition/components/NutritionTracker';

export default function NutritionPage() {
  return (
    <div className="space-y-4">
      <header className="px-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#F5BA42] px-2.5 py-0.5 text-[10px] font-black tracking-wider text-stone-950 uppercase">
          <Utensils className="h-3 w-3" />
          NUTRITION & MACROS
        </span>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-[#FAF7F5] uppercase">
          Питание (КБЖУ)
        </h1>
        <p className="mt-1 text-xs text-[#A8A199]">
          Калькулятор граммовок, экспресс-парсер рациона и шкалы суточной нормы
        </p>
      </header>

      <NutritionTracker />
    </div>
  );
}