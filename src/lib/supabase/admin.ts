import { createClient } from '@supabase/supabase-js';

/**
 * Серверный клиент Supabase с правами Service Role.
 * ВАЖНО: Используется ТОЛЬКО на сервере (например, в /api/telegram/webhook),
 * где нет пользовательских cookies, а идентификация выполняется по проверенному telegram_chat_id.
 */
export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Отсутствуют переменные окружения NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
