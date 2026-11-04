'use client';

import React, { useEffect, useState } from 'react';
import { LogIn, LogOut, User, CheckCircle2, AlertTriangle, X, Loader2 } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { hapticImpact, hapticNotification } from '@/lib/telegram/webapp';

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
    hapticImpact('medium');

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
        hapticNotification('error');
        return;
      }

      if (data.user) {
        hapticNotification('success');
        setIsModalOpen(false);
        setPassword('');
        window.location.reload();
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Ошибка входа');
      hapticNotification('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    hapticImpact('light');
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
    <div className="mb-4">
      {userEmail ? (
        // Авторизованный профиль: Темный графит с лаймовыми акцентами
        <div className="flex items-center justify-between gap-2.5 rounded-3xl border border-white/5 bg-gradient-to-r from-[#181820] to-[#14141A] p-3 shadow-xl shadow-black/60">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-[#C4F124]/10 text-[#C4F124] ring-1 ring-[#C4F124]/25">
              <User className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-[#FFFFFF]">{userEmail}</p>
              <p className="flex items-center gap-1 text-[10px] font-medium text-[#8F90A6]">
                <CheckCircle2 className="h-3 w-3 shrink-0 text-[#C4F124]" />
                {telegramId ? 'Telegram синхронизирован' : 'Облако активно'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex shrink-0 items-center gap-1 rounded-2xl border border-white/5 bg-[#1C1C24] px-3 py-1.5 text-[11px] font-semibold text-[#8F90A6] transition hover:text-[#FFFFFF] active:scale-95"
          >
            <LogOut className="h-3 w-3" />
            Выйти
          </button>
        </div>
      ) : (
        // Неавторизованный профиль: Тёмный графит с оранжевым индикатором и лаймовой кнопкой
        <div className="flex items-center justify-between gap-3 rounded-3xl border border-white/5 bg-gradient-to-r from-[#181820] to-[#121217] p-3.5 shadow-xl shadow-black/60">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[#FF6D3B]" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#FFFFFF]">Демо-режим</p>
              <p className="text-[11px] text-[#8F90A6]">Войдите для сохранения в облако и Telegram</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              hapticImpact('medium');
              setIsModalOpen(true);
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-[#C4F124] px-3.5 py-2 text-xs font-black text-black shadow-lg shadow-[#C4F124]/20 transition active:scale-95 hover:bg-[#b2dc1e]"
          >
            <LogIn className="h-3.5 w-3.5 stroke-[2.5]" />
            Войти
          </button>
        </div>
      )}

      {/* Модальное окно входа в стиле Cyber Lime */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-gradient-to-b from-[#1C1C24] to-[#121217] p-5 shadow-2xl shadow-black/90">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#C4F124]">
                  GYM DIARY PRO
                </span>
                <h2 className="text-lg font-black tracking-tight text-[#FFFFFF] uppercase">
                  Вход в аккаунт
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  hapticImpact('light');
                  setIsModalOpen(false);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-2xl bg-white/5 text-[#8F90A6] transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-2 text-xs text-[#8F90A6]">
              Войдите в аккаунт, чтобы сохранять подходы, книги и питание в облаке и мгновенно получать отчеты в Telegram.
            </p>

            <form onSubmit={handleLogin} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-semibold tracking-wider text-[#8F90A6] uppercase">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  className="w-full rounded-2xl border border-white/10 bg-[#0B0B0E] px-3.5 py-2.5 text-sm text-[#FFFFFF] placeholder:text-[#8F90A6]/40 focus:border-[#C4F124] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold tracking-wider text-[#8F90A6] uppercase">
                  Пароль
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ваш пароль"
                  className="w-full rounded-2xl border border-white/10 bg-[#0B0B0E] px-3.5 py-2.5 text-sm text-[#FFFFFF] placeholder:text-[#8F90A6]/40 focus:border-[#C4F124] focus:outline-none"
                />
              </div>

              {authError && (
                <div className="rounded-2xl border border-rose-900/40 bg-rose-950/20 p-3 text-xs text-rose-300">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#C4F124] py-3 text-sm font-black text-black uppercase shadow-lg shadow-[#C4F124]/20 transition hover:bg-[#b2dc1e] active:scale-95 disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-black" />
                    <span>Проверка...</span>
                  </>
                ) : (
                  <span>Войти в Ежедневник</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
