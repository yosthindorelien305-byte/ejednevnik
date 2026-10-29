import { NutritionTracker } from '@/features/nutrition/components/NutritionTracker';

export default function NutritionPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold tracking-tight">Питание (КБЖУ)</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Калькулятор граммовок, экспресс-парсер рациона и шкалы суточной нормы
        </p>
      </header>
      <NutritionTracker />
    </div>
  );
}
