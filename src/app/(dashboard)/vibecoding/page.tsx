import { Terminal } from 'lucide-react';
import { VibecodingWorkspace } from '@/features/vibecoding/components/VibecodingWorkspace';

export default function VibecodingPage() {
  return (
    <div className="space-y-4">
      <header className="px-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#F5BA42] px-2.5 py-0.5 text-[10px] font-black tracking-wider text-stone-950 uppercase">
          <Terminal className="h-3 w-3" />
          DEV SPRINTS & VIBECODING
        </span>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-[#FAF7F5] uppercase">
          Вайбкодинг
        </h1>
        <p className="mt-1 text-xs text-[#A8A199]">
          Спринты разработки, трекер пет-проектов, сниппеты кода и база полезных ссылок
        </p>
      </header>

      <VibecodingWorkspace />
    </div>
  );
}