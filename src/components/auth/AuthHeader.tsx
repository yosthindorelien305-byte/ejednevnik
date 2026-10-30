'use client';

import React, { useEffect, useState } from 'react';
import { LogIn, LogOut, User, CheckCircle2, AlertTriangle, X, Loader2 } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export function AuthHeader() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [telegramId, setTelegramId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Поля формы авторизации
  const [email, setEmail] = useState<string>('rizvanovnasir@gmail.com');
  const [password, setPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchUserStatus = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setUserEmail(user.email ?? 'Авторизован');
        // Запрашиваем статус привязки Telegram
        const { data: profile } = await supabase
          .from('profiles')
          .select('telegram_id')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.telegram_id) {
          setTelegramId(profile.telegram_id);
        }
      } else {
        setUserEmail(null);
        setTelegramId(null);
      }
    } catch {
      setUserEmail(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchUserStatus();

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void fetchUserStatus();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmitting(true);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAuthError('Supabase не настроен в приложении');
      setIsSubmitting(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        setAuthError(error.message);
        return;
      }

      if (data.user) {
        setIsModalOpen(false);
        setPassword('');
        // Перезагружаем страницу, чтобы серверные компоненты (чтение, тренировки) получили куки сессии
        window.location.reload();
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    setUserEmail(null);
    setTelegramId(null);
    window.location.reload();
  };

  if (isLoading) {
    return null;
  }

  return (
    <div className="mb-3">
      {userEmail ? (
        // Пользователь вошел в аккаунт
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2 text-xs text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <User className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium">{userEmail}</p>
              <p className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3 shrink-0" />
                {telegramId ? 'Telegram синхронизирован' : 'Синхронизация активна'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 transition hover:bg-white active:scale-95 dark:bg-zinc-800 dark:text-zinc-300"
          >
            <LogOut className="h-3 w-3" />
            Выйти
          </button>
        </div>
      ) : (
        // Пользователь НЕ авторизован (демо-режим)
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/15 p-3 text-xs text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-bold">Вы не вошли в аккаунт</p>
              <p className="text-[11px] opacity-90">Записи не сохраняются в облако и не идут в бот</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 font-bold text-white shadow-xs transition hover:bg-amber-500 active:scale-95"
          >
            <LogIn className="h-3.5 w-3.5" />
            Войти
          </button>
        </div>
      )}

      {/* Модальное окно входа в аккаунт в стиле iOS */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Вход в Ежедневник
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Войдите в аккаунт, чтобы сохранять тренировки, книги и питание в базу данных и получать отчеты в Telegram.
            </p>

            <form onSubmit={handleLogin} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ваш-email@gmail.com"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Пароль
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ваш пароль"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              {authError && (
                <div className="rounded-xl bg-rose-500/15 p-2.5 text-xs text-rose-700 dark:text-rose-300">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60 active:scale-98"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Вход...
                  </>
                ) : (
                  'Войти в аккаунт'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
