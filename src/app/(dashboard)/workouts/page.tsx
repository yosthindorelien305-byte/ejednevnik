import { WorkoutForm } from '@/features/workouts/components/WorkoutForm';

export default function WorkoutsPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold tracking-tight">Тренировки</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Добавляйте рабочие подходы, отслеживайте тоннаж и фиксируйте форму
        </p>
      </header>
      <WorkoutForm />
    </div>
  );
}
