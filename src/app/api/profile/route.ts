import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    let userId: string | null = null;
    const supabaseAdmin = createSupabaseAdminClient();

    // 1. Проверяем заголовок Authorization: Bearer <token>
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.slice(7).trim();
      try {
        const {
          data: { user: tokenUser },
        } = await supabaseAdmin.auth.getUser(token);
        if (tokenUser) userId = tokenUser.id;
      } catch {
        // ignore invalid token
      }
    }

    // 2. Проверяем серверные cookies
    if (!userId) {
      try {
        const serverSupabase = await createSupabaseServerClient();
        if (serverSupabase) {
          const {
            data: { user: cookieUser },
          } = await serverSupabase.auth.getUser();
          if (cookieUser) userId = cookieUser.id;
        }
      } catch {
        // ignore cookie errors
      }
    }

    // 3. Проверяем query-параметр ?userId=...
    const { searchParams } = new URL(request.url);
    const queryUserId = searchParams.get('userId');
    if (!userId && queryUserId) {
      userId = queryUserId;
    }

    let targetProfile: Record<string, unknown> | null = null;
    let userMeta: Record<string, unknown> | undefined = undefined;

    if (userId) {
      try {
        const { data } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        targetProfile = data;
      } catch {
        // ignore
      }

      try {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
        userMeta = userData?.user?.user_metadata;
      } catch {
        // ignore
      }
    } else {
      // Ищем профиль владельца (по telegram_id 483395113 или первый профиль)
      try {
        const { data: ownerProfile } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('telegram_id', 483395113)
          .maybeSingle();

        if (ownerProfile) {
          targetProfile = ownerProfile;
          userId = ownerProfile.id as string;
        } else {
          const { data: anyProfile } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .limit(1)
            .maybeSingle();
          targetProfile = anyProfile;
          if (anyProfile?.id) userId = anyProfile.id as string;
        }

        if (userId) {
          const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
          userMeta = userData?.user?.user_metadata;
        }
      } catch {
        // ignore
      }
    }

    const hasCustomWeight =
      targetProfile?.body_weight !== undefined && targetProfile?.body_weight !== null
        ? true
        : userMeta?.body_weight !== undefined && userMeta?.body_weight !== null;

    const hasCustomHeight =
      targetProfile?.body_height !== undefined && targetProfile?.body_height !== null
        ? true
        : userMeta?.body_height !== undefined && userMeta?.body_height !== null;

    const hasCustomRest =
      targetProfile?.default_rest_seconds !== undefined && targetProfile?.default_rest_seconds !== null
        ? true
        : userMeta?.default_rest_seconds !== undefined && userMeta?.default_rest_seconds !== null;

    const isCustom = hasCustomWeight || hasCustomHeight || hasCustomRest;

    const rawWeight = targetProfile?.body_weight ?? userMeta?.body_weight;
    const rawHeight = targetProfile?.body_height ?? userMeta?.body_height;
    const rawRest = targetProfile?.default_rest_seconds ?? userMeta?.default_rest_seconds;

    return NextResponse.json({
      ok: true,
      isCustom,
      profile: {
        weightKg: rawWeight !== undefined && rawWeight !== null ? Number(rawWeight) : 75,
        heightCm: rawHeight !== undefined && rawHeight !== null ? Number(rawHeight) : 178,
        defaultRestSeconds: rawRest !== undefined && rawRest !== null ? Number(rawRest) : 90,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        isCustom: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      weightKg,
      heightCm,
      defaultRestSeconds,
      userId: explicitUserId,
    } = body;

    const supabaseAdmin = createSupabaseAdminClient();
    let targetUserId = explicitUserId || null;

    // 1. Проверяем заголовок Authorization
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
    if (!targetUserId && authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.slice(7).trim();
      try {
        const {
          data: { user: tokenUser },
        } = await supabaseAdmin.auth.getUser(token);
        if (tokenUser) targetUserId = tokenUser.id;
      } catch {
        // ignore
      }
    }

    // 2. Проверяем cookies
    if (!targetUserId) {
      try {
        const serverSupabase = await createSupabaseServerClient();
        if (serverSupabase) {
          const {
            data: { user: cookieUser },
          } = await serverSupabase.auth.getUser();
          if (cookieUser) targetUserId = cookieUser.id;
        }
      } catch {
        // ignore
      }
    }

    // 3. Fallback к профилю владельца
    if (!targetUserId) {
      try {
        const { data: ownerProfile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('telegram_id', 483395113)
          .maybeSingle();

        if (ownerProfile?.id) {
          targetUserId = ownerProfile.id as string;
        } else {
          const { data: firstProfile } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .limit(1)
            .maybeSingle();
          if (firstProfile?.id) targetUserId = firstProfile.id as string;
        }
      } catch {
        // ignore
      }
    }

    const parsedWeight = Math.round(Number(weightKg) * 10) / 10 || 75;
    const parsedHeight = Math.round(Number(heightCm)) || 178;
    const parsedRest = Math.max(10, Math.round(Number(defaultRestSeconds) || 90));

    if (targetUserId) {
      // 1. Сохраняем в Supabase auth user_metadata (гарантированно работает в облаке Supabase Auth)
      try {
        await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
          user_metadata: {
            body_weight: parsedWeight,
            body_height: parsedHeight,
            default_rest_seconds: parsedRest,
          },
        });
      } catch (metaErr) {
        console.warn('[profile API] updateUserById warning:', metaErr);
      }

      // 2. Сохраняем в таблицу public.profiles
      try {
        await supabaseAdmin
          .from('profiles')
          .update({
            body_weight: parsedWeight,
            body_height: parsedHeight,
            default_rest_seconds: parsedRest,
          })
          .eq('id', targetUserId);
      } catch (profErr) {
        console.warn('[profile API] update profiles table warning:', profErr);
      }
    }

    return NextResponse.json({
      ok: true,
      isCustom: true,
      profile: {
        weightKg: parsedWeight,
        heightCm: parsedHeight,
        defaultRestSeconds: parsedRest,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
