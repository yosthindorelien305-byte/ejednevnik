import { BookOpen } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { BooksAndQuranPageClient } from '@/features/reading/components/BooksAndQuranPageClient';
import type { BooksAndQuranRow } from '@/features/reading/types';

// Отключаем статическое кэширование, чтобы при каждом открытии подтягивались свежие записи из бота
export const dynamic = 'force-dynamic';

export default async function ReadingPage() {
  const supabase = await createSupabaseServerClient();

  let initialUserId: string | null = null;
  let initialItems: BooksAndQuranRow[] | undefined = undefined;

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      initialUserId = user.id;
      const { data } = await supabase
        .from('books_and_quran')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (data) {
        initialItems = data as BooksAndQuranRow[];
      }
    }
  }

  return (
    <div className="space-y-4">
      <header className="px-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#F5BA42] px-2.5 py-0.5 text-[10px] font-black tracking-wider text-stone-950 uppercase">
          <BookOpen className="h-3 w-3" />
          READING & QURAN TRACKER
        </span>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-[#FAF7F5] uppercase">
          Книги и Коран
        </h1>
        <p className="mt-1 text-xs text-[#A8A199]">
          Живая синхронизация страниц, аятов, полезных ссылок и скриншотов с Telegram-ботом
        </p>
      </header>

      <BooksAndQuranPageClient
        initialItems={initialItems}
        initialUserId={initialUserId}
      />
    </div>
  );
}
