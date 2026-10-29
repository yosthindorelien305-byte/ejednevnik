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
      <header>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Книги и Коран
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
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
