'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Серверный экшен получения Deep Link ссылки с кодом sync_token из profiles
 * для привязки Telegram ID к текущему авторизованному пользователю Supabase.
 */
export async function generateTelegramConnectUrl(): Promise<{
  deepLinkUrl?: string;
  syncToken?: string;
  error?: string;
}> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { error: 'Не заданы переменные окружения Supabase' };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Необходимо войти в аккаунт Ежедневника' };
  }

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  if (!botUsername) {
    return { error: 'Не задан NEXT_PUBLIC_TELEGRAM_BOT_USERNAME' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('sync_token')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.sync_token) {
    return { error: profileError?.message ?? 'Профиль пользователя не найден' };
  }

  const cleanUsername = botUsername.replace(/^@/, '');
  return {
    deepLinkUrl: `https://t.me/${cleanUsername}?start=${profile.sync_token}`,
    syncToken: profile.sync_token,
  };
}
