// Типы данных раздела «Книги и Коран», полностью соответствующие таблице public.books_and_quran

export type ReadingCategory = 'book' | 'quran';

export type SyncSource = 'web' | 'telegram';

export interface BooksAndQuranRow {
  id: string;
  user_id: string;
  category: ReadingCategory;
  title: string;
  current_position: number;
  total_target: number;
  progress_percent?: number;
  notes: string | null;
  resource_urls: string[];
  media_urls: string[];
  last_updated_by: SyncSource;
  created_at: string;
  updated_at: string;
}

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';
