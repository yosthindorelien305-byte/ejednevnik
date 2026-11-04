import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export interface UserBodyProfile {
  weightKg: number;
  heightCm: number;
  defaultRestSeconds: number;
  updatedAt?: string;
}

const BODY_PROFILE_KEY = 'ejednevnik_user_body_profile';

const DEFAULT_PROFILE: UserBodyProfile = {
  weightKg: 75,
  heightCm: 178,
  defaultRestSeconds: 90,
};

/**
 * Синхронное чтение профиля из localStorage для мгновенного первого рендера.
 */
export function getUserBodyProfile(): UserBodyProfile {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem(BODY_PROFILE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.weightKg === 'number' && parsed.weightKg > 0) {
      return {
        weightKg: Number(parsed.weightKg) || 75,
        heightCm: Number(parsed.heightCm) || 178,
        defaultRestSeconds: Math.max(10, Number(parsed.defaultRestSeconds) || 90),
        updatedAt: parsed.updatedAt,
      };
    }
  } catch {
    // fallback
  }
  return DEFAULT_PROFILE;
}

/**
 * Асинхронная загрузка актуального профиля из Supabase базы данных и API.
 */
export async function fetchUserBodyProfileAsync(): Promise<UserBodyProfile> {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;

  // 1. Сначала пробуем получить данные через серверный API /api/profile
  try {
    const res = await fetch('/api/profile', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data?.ok && data.profile) {
        const enriched: UserBodyProfile = {
          weightKg: Number(data.profile.weightKg) || 75,
          heightCm: Number(data.profile.heightCm) || 178,
          defaultRestSeconds: Math.max(10, Number(data.profile.defaultRestSeconds) || 90),
          updatedAt: new Date().toISOString(),
        };
        try {
          localStorage.setItem(BODY_PROFILE_KEY, JSON.stringify(enriched));
        } catch {
          // ignore
        }
        return enriched;
      }
    }
  } catch (err) {
    console.warn('[fetchUserBodyProfileAsync API failed]:', err);
  }

  // 2. Вторая попытка: напрямую через клиент Supabase
  try {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Проверяем таблицу profiles
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('body_weight, body_height, default_rest_seconds')
          .eq('id', user.id)
          .maybeSingle();

        const userMeta = user.user_metadata || {};

        const weight =
          profileRow?.body_weight ??
          userMeta.body_weight ??
          userMeta.weightKg;
        const height =
          profileRow?.body_height ??
          userMeta.body_height ??
          userMeta.heightCm;
        const rest =
          profileRow?.default_rest_seconds ??
          userMeta.default_rest_seconds ??
          userMeta.defaultRestSeconds;

        if (weight || height || rest) {
          const enriched: UserBodyProfile = {
            weightKg: Number(weight) || 75,
            heightCm: Number(height) || 178,
            defaultRestSeconds: Math.max(10, Number(rest) || 90),
            updatedAt: new Date().toISOString(),
          };
          try {
            localStorage.setItem(BODY_PROFILE_KEY, JSON.stringify(enriched));
          } catch {
            // ignore
          }
          return enriched;
        }
      }
    }
  } catch (err) {
    console.warn('[fetchUserBodyProfileAsync direct Supabase failed]:', err);
  }

  // 3. Fallback к локальному кэшу
  return getUserBodyProfile();
}

/**
 * Надежное сохранение профиля в localStorage + Supabase базу данных (таблицу profiles)
 * и auth user_metadata.
 */
export async function saveUserBodyProfile(
  profile: UserBodyProfile
): Promise<UserBodyProfile> {
  const enriched: UserBodyProfile = {
    weightKg: Math.round(Number(profile.weightKg) * 10) / 10,
    heightCm: Math.round(Number(profile.heightCm)),
    defaultRestSeconds: Math.max(10, Math.round(Number(profile.defaultRestSeconds) || 90)),
    updatedAt: new Date().toISOString(),
  };

  // 1. Мгновенно сохраняем в локальный кэш
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(BODY_PROFILE_KEY, JSON.stringify(enriched));
    } catch {
      // localStorage error
    }
  }

  // 2. Отправляем в серверный эндпоинт для сохранения в Supabase базу данных
  try {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weightKg: enriched.weightKg,
        heightCm: enriched.heightCm,
        defaultRestSeconds: enriched.defaultRestSeconds,
      }),
    });
    if (res.ok) {
      const respData = await res.json();
      if (respData?.profile) {
        enriched.weightKg = respData.profile.weightKg;
        enriched.heightCm = respData.profile.heightCm;
        enriched.defaultRestSeconds = respData.profile.defaultRestSeconds;
      }
    }
  } catch (err) {
    console.warn('[saveUserBodyProfile API post failed]:', err);
  }

  // 3. Сохраняем также через браузерный клиент Supabase (если авторизован)
  try {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Обновляем метаданные Auth
        try {
          await supabase.auth.updateUser({
            data: {
              body_weight: enriched.weightKg,
              body_height: enriched.heightCm,
              default_rest_seconds: enriched.defaultRestSeconds,
            },
          });
        } catch {
          // ignore
        }

        // Обновляем таблицу profiles
        try {
          await supabase
            .from('profiles')
            .update({
              body_weight: enriched.weightKg,
              body_height: enriched.heightCm,
              default_rest_seconds: enriched.defaultRestSeconds,
            })
            .eq('id', user.id);
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }

  return enriched;
}

export function calculateBmi(weightKg: number, heightCm: number): {
  bmi: number;
  label: string;
  colorClass: string;
} {
  if (!weightKg || !heightCm || heightCm <= 0) {
    return { bmi: 0, label: '—', colorClass: 'text-[#A8A199]' };
  }
  const heightM = heightCm / 100;
  const rawBmi = weightKg / (heightM * heightM);
  const bmi = Math.round(rawBmi * 10) / 10;

  if (bmi < 18.5) {
    return { bmi, label: 'Дефицит массы', colorClass: 'text-amber-400' };
  } else if (bmi <= 24.9) {
    return { bmi, label: 'Норма', colorClass: 'text-emerald-400' };
  } else if (bmi <= 29.9) {
    return { bmi, label: 'Атлетичное / Плотное', colorClass: 'text-[#F5BA42]' };
  } else {
    return { bmi, label: 'Выше нормы', colorClass: 'text-rose-400' };
  }
}
