import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    let userId: string | null = null;
    const serverSupabase = await createSupabaseServerClient();
    if (serverSupabase) {
      const {
        data: { user },
      } = await serverSupabase.auth.getUser();
      if (user) userId = user.id;
    }

    const { searchParams } = new URL(request.url);
    const queryUserId = searchParams.get('userId');
    if (queryUserId) userId = queryUserId;

    const supabaseAdmin = createSupabaseAdminClient();

    let targetProfile: {
      body_weight?: number | null;
      body_height?: number | null;
      default_rest_seconds?: number | null;
    } | null = null;
    let userMeta: Record<string, unknown> | undefined = undefined;

    if (userId) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      targetProfile = data;

      try {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
        userMeta = userData?.user?.user_metadata;
      } catch {
        // ignore
      }
    } else {
      // Fallback к первому профилю в базе
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .limit(1)
        .maybeSingle();
      targetProfile = data;
    }

    const weightKg =
      targetProfile?.body_weight ??
      (userMeta?.body_weight as number | undefined) ??
      75;
    const heightCm =
      targetProfile?.body_height ??
      (userMeta?.body_height as number | undefined) ??
      178;
    const defaultRestSeconds =
      targetProfile?.default_rest_seconds ??
      (userMeta?.default_rest_seconds as number | undefined) ??
      90;

    return NextResponse.json({
      ok: true,
      profile: {
        weightKg: Math.round(Number(weightKg) * 10) / 10 || 75,
        heightCm: Math.round(Number(heightCm)) || 178,
        defaultRestSeconds: Math.max(10, Math.round(Number(defaultRestSeconds) || 90)),
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      weightKg,
      heightCm,
      defaultRestSeconds,
      userId: explicitUserId,
    } = body;

    let targetUserId = explicitUserId || null;
    if (!targetUserId) {
      const serverSupabase = await createSupabaseServerClient();
      if (serverSupabase) {
        const {
          data: { user },
        } = await serverSupabase.auth.getUser();
        if (user) targetUserId = user.id;
      }
    }

    const supabaseAdmin = createSupabaseAdminClient();

    if (!targetUserId) {
      const { data: firstProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .limit(1)
        .maybeSingle();
      if (firstProfile?.id) targetUserId = firstProfile.id;
    }

    const parsedWeight = Math.round(Number(weightKg) * 10) / 10 || 75;
    const parsedHeight = Math.round(Number(heightCm)) || 178;
    const parsedRest = Math.max(10, Math.round(Number(defaultRestSeconds) || 90));

    if (targetUserId) {
      // 1. Сохраняем в Supabase auth user_metadata (гарантированно работает без миграций)
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
