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
        defaultRestSeconds: Number(parsed.defaultRestSeconds) || 90,
        updatedAt: parsed.updatedAt,
      };
    }
  } catch {
    // fallback
  }
  return DEFAULT_PROFILE;
}

export function saveUserBodyProfile(profile: UserBodyProfile): void {
  if (typeof window === 'undefined') return;
  const enriched: UserBodyProfile = {
    weightKg: Math.round(Number(profile.weightKg) * 10) / 10,
    heightCm: Math.round(Number(profile.heightCm)),
    defaultRestSeconds: Math.max(10, Math.round(Number(profile.defaultRestSeconds) || 90)),
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(BODY_PROFILE_KEY, JSON.stringify(enriched));
  } catch {
    // localStorage error
  }

  // Асинхронно сохраняем в метаданные пользователя Supabase
  try {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      void supabase.auth.updateUser({
        data: {
          body_weight: enriched.weightKg,
          body_height: enriched.heightCm,
          default_rest_seconds: enriched.defaultRestSeconds,
        },
      }).catch(() => null);
    }
  } catch {
    // ignore
  }
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
