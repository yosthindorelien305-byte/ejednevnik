import { VibecodingWorkspace } from '@/features/vibecoding/components/VibecodingWorkspace';

export default function VibecodingPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Вайбкодинг</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Спринты разработки, заметки по коду, полезные ссылки и проекты
        </p>
      </header>
      <VibecodingWorkspace />
    </div>
  );
}
