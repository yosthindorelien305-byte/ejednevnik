import { WorkoutForm } from '@/features/workouts/components/WorkoutForm';
import { Dumbbell } from 'lucide-react';

export default function WorkoutsPage() {
  return (
    <div className="space-y-4">
      <header className="px-1">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#F5BA42] px-2.5 py-0.5 text-[10px] font-black tracking-wider text-stone-950 uppercase">
            <Dumbbell className="h-3 w-3" />
            WORKOUT TRACKER
          </span>
        </div>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-[#FAF7F5] uppercase">
          Тренировки
        </h1>
        <p className="mt-0.5 text-xs text-[#A8A199]">
          Фиксация подходов, автоподсчет тоннажа и галерея фото формы
        </p>
      </header>
      <WorkoutForm />
    </div>
  );
}
