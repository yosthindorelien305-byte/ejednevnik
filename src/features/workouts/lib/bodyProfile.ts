import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export interface UserBodyProfile {
  weightKg: number;
  heightCm: number;
  defaultRestSeconds: number;
  updatedAt?: string;
  isCustom?: boolean;
}

const BODY_PROFILE_KEY = 'ejednevnik_user_body_profile';

export const DEFAULT_PROFILE: UserBodyProfile = {
  weightKg: 75,
  heightCm: 178,
  defaultRestSeconds: 90,
  isCustom: false,
};

/**
 * Синхронное получение профиля из localStorage для мгновенного первого рендера.
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
        isCustom: parsed.isCustom ?? true,
      };
    }
  } catch {
    // fallback
  }
  return DEFAULT_PROFILE;
}

/**
 * Асинхронная загрузка актуального профиля из Supabase базы данных и API.
 * ВАЖНО: Никогда не перезаписывает сохраненные пользователем локальные данные
 * дефолтными значениями (75/178/90), если сервер вернул дефолты.
 */
export async function fetchUserBodyProfileAsync(): Promise<UserBodyProfile> {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;

  const localProfile = getUserBodyProfile();

  // 1. Проверяем клиентскую сессию Supabase
  let accessToken: string | null = null;
  let clientUserId: string | null = null;

  try {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        accessToken = session.access_token;
        clientUserId = session.user.id;

        // Если в сессии браузера уже есть сохраненные метаданные — они самые свежие
        const meta = session.user.user_metadata;
        if (
          meta &&
          (meta.body_weight !== undefined ||
            meta.body_height !== undefined ||
            meta.default_rest_seconds !== undefined)
        ) {
          const fromMeta: UserBodyProfile = {
            weightKg: Number(meta.body_weight) || localProfile.weightKg || 75,
            heightCm: Number(meta.body_height) || localProfile.heightCm || 178,
            defaultRestSeconds: Math.max(
              10,
              Number(meta.default_rest_seconds) || localProfile.defaultRestSeconds || 90
            ),
            isCustom: true,
            updatedAt: new Date().toISOString(),
          };
          try {
            localStorage.setItem(BODY_PROFILE_KEY, JSON.stringify(fromMeta));
          } catch {
            // ignore
          }
          return fromMeta;
        }
      }
    }
  } catch {
    // ignore
  }

  // 2. Делаем запрос к серверному API /api/profile
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const url = clientUserId
      ? `/api/profile?userId=${encodeURIComponent(clientUserId)}`
      : '/api/profile';

    const res = await fetch(url, { headers, cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data?.ok && data.profile) {
        // Если сервер вернул кастомные параметры ИЛИ у нас локально еще нет кастомных
        if (data.isCustom || !localProfile.isCustom) {
          const enriched: UserBodyProfile = {
            weightKg: Number(data.profile.weightKg) || 75,
            heightCm: Number(data.profile.heightCm) || 178,
            defaultRestSeconds: Math.max(10, Number(data.profile.defaultRestSeconds) || 90),
            isCustom: Boolean(data.isCustom),
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
    console.warn('[fetchUserBodyProfileAsync error]:', err);
  }

  // 3. Возвращаем локальный профиль, если он уже был настроен
  return localProfile;
}

/**
 * Надежное сохранение профиля:
 * 1. В локальный кэш localStorage (гарантирует немедленную отзывчивость UI).
 * 2. В метаданные пользователя Supabase Auth (работает мгновенно в облаке).
 * 3. В серверный эндпоинт /api/profile (обновляет таблицу profiles в Supabase).
 */
export async function saveUserBodyProfile(
  profile: UserBodyProfile
): Promise<UserBodyProfile> {
  const enriched: UserBodyProfile = {
    weightKg: Math.round(Number(profile.weightKg) * 10) / 10,
    heightCm: Math.round(Number(profile.heightCm)),
    defaultRestSeconds: Math.max(10, Math.round(Number(profile.defaultRestSeconds) || 90)),
    isCustom: true,
    updatedAt: new Date().toISOString(),
  };

  // 1. Мгновенно фиксируем в localStorage
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(BODY_PROFILE_KEY, JSON.stringify(enriched));
    } catch {
      // localStorage error
    }
  }

  let accessToken: string | null = null;
  let clientUserId: string | null = null;

  // 2. Обновляем сессию браузерного клиента Supabase
  try {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        accessToken = session.access_token;
        clientUserId = session.user.id;

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
            .eq('id', session.user.id);
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }

  // 3. Отправляем в серверный эндпоинт /api/profile
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const res = await fetch('/api/profile', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        weightKg: enriched.weightKg,
        heightCm: enriched.heightCm,
        defaultRestSeconds: enriched.defaultRestSeconds,
        userId: clientUserId,
      }),
    });

    if (res.ok) {
      const respData = await res.json();
      if (respData?.profile) {
        enriched.weightKg = respData.profile.weightKg;
        enriched.heightCm = respData.profile.heightCm;
        enriched.defaultRestSeconds = respData.profile.defaultRestSeconds;
        enriched.isCustom = true;
      }
    }
  } catch (err) {
    console.warn('[saveUserBodyProfile API post warning]:', err);
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
