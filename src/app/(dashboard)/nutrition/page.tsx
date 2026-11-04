import { Utensils } from 'lucide-react';
import { NutritionTracker } from '@/features/nutrition/components/NutritionTracker';

export default function NutritionPage() {
  return (
    <div className="space-y-4">
      <header className="px-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#C4F124] px-2.5 py-0.5 text-[10px] font-black tracking-wider text-black uppercase">
          <Utensils className="h-3 w-3 stroke-[2.5]" />
          NUTRITION & MACROS
        </span>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-white uppercase">
          Питание и КБЖУ
        </h1>
        <p className="mt-1 text-xs text-[#8F90A6]">
          Калькулятор суточной нормы, круговой счетчик калорий и лог приемов пищи
        </p>
      </header>

      <NutritionTracker />
    </div>
  );
}
