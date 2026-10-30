import { NextResponse } from 'next/server';
import { InlineKeyboard } from 'grammy';
import { getTelegramBot } from '@/lib/telegram/bot';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getWebAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://example.com';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderAsciiBar(percent: number, length = 12): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Завтрак 🥞',
  lunch: 'Обед 🍲',
  dinner: 'Ужин 🍽️',
  snack: 'Перекус 🥪',
};

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { type, data, userId: explicitUserId } = body;

    // Определяем user_id либо из сессии, либо из явного запроса
    let userId: string | null = explicitUserId || null;

    if (!userId) {
      const serverSupabase = await createSupabaseServerClient();
      if (serverSupabase) {
        const {
          data: { user },
        } = await serverSupabase.auth.getUser();
        if (user) userId = user.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'Пользователь не авторизован' },
        { status: 401 }
      );
    }

    // Получаем привязанный telegram_id пользователя из базы
    const supabase = createSupabaseAdminClient();
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('telegram_id, display_name, daily_calories_goal')
      .eq('id', userId)
      .maybeSingle();

    if (profileErr || !profile?.telegram_id) {
      // Telegram не привязан — тихо пропускаем, не ломая интерфейс
      return NextResponse.json({
        ok: true,
        sent: false,
        reason: 'telegram_not_linked',
      });
    }

    const bot = getTelegramBot();
    const inlineKb = new InlineKeyboard().webApp(
      '📱 Открыть в Ежедневнике',
      getWebAppUrl()
    );

    let messageHtml = '';

    // =========================================================================
    // 1. УВЕДОМЛЕНИЕ О ТРЕНИРОВКЕ (WORKOUT)
    // =========================================================================
    if (type === 'workout') {
      const {
        title = 'Силовая тренировка',
        workoutDate,
        totalTonnage = 0,
        wellbeingRating,
        wellbeingNotes,
        exercises = [],
      } = data;

      const dateStr = workoutDate
        ? new Date(workoutDate).toLocaleDateString('ru-RU')
        : new Date().toLocaleDateString('ru-RU');

      const lines: string[] = [
        '<b>🏋️‍♂️ Новая тренировка сохранена с сайта!</b>',
        '',
        `📅 <b>Дата:</b> ${escapeHtml(dateStr)}`,
        `🏷 <b>Сплит:</b> ${escapeHtml(title)}`,
        `🔥 <b>Общий тоннаж:</b> ${Number(totalTonnage).toLocaleString('ru-RU')} кг`,
      ];

      if (wellbeingRating) {
        lines.push(`❤️ <b>Самочувствие:</b> ${wellbeingRating} / 10`);
      }
      if (wellbeingNotes) {
        lines.push(`💭 <b>Заметка:</b> <i>${escapeHtml(wellbeingNotes)}</i>`);
      }

      if (exercises.length > 0) {
        lines.push('');
        lines.push('📋 <b>Упражнения и подходы:</b>');
        exercises.forEach(
          (
            ex: {
              exerciseName: string;
              setsCount: number;
              repsCount: number;
              workingWeight: number;
              exerciseTonnage?: number;
            },
            idx: number
          ) => {
            const tonnagePart = ex.exerciseTonnage
              ? ` (${ex.exerciseTonnage} кг)`
              : '';
            lines.push(
              `${idx + 1}. <b>${escapeHtml(ex.exerciseName)}</b>: ${ex.workingWeight} кг × ${ex.setsCount} подх. × ${ex.repsCount} повт.${tonnagePart}`
            );
          }
        );
      }

      messageHtml = lines.join('\n');
    }

    // =========================================================================
    // 2. УВЕДОМЛЕНИЕ О ЧТЕНИИ КНИГИ ИЛИ КОРАНА (READING)
    // =========================================================================
    else if (type === 'reading') {
      const {
        category,
        title,
        currentPosition,
        totalTarget,
        notes,
        resourceUrls = [],
      } = data;

      const isQuran = category === 'quran';
      const unit = isQuran ? 'аят / стр.' : 'стр.';
      const icon = isQuran ? '🕋' : '📖';
      const header = isQuran
        ? '<b>🕋 Прогресс чтения Корана обновлен!</b>'
        : '<b>📖 Прогресс книги сохранен!</b>';

      const safeTarget = Math.max(1, totalTarget);
      const percent = Math.min(
        100,
        Math.round((currentPosition / safeTarget) * 1000) / 10
      );
      const bar = renderAsciiBar(percent);

      const lines: string[] = [
        header,
        '',
        `${icon} <b>Название:</b> «${escapeHtml(title)}»`,
        `📄 <b>Прогресс:</b> ${currentPosition} из ${totalTarget} ${unit} (<b>${percent}%</b>)`,
        `<code>[${bar}] ${percent}%</code>`,
      ];

      if (notes && notes.trim()) {
        lines.push('');
        lines.push(`📝 <b>Заметки / Тадаббур:</b>\n<i>${escapeHtml(notes.trim())}</i>`);
      }

      if (resourceUrls.length > 0) {
        lines.push('');
        lines.push('🔗 <b>Ссылки на материалы:</b>');
        resourceUrls.slice(0, 3).forEach((url: string) => {
          lines.push(`• <a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`);
        });
      }

      messageHtml = lines.join('\n');
    }

    // =========================================================================
    // 3. УВЕДОМЛЕНИЕ О ПРИЕМЕ ПИЩИ И КБЖУ (NUTRITION)
    // =========================================================================
    else if (type === 'nutrition') {
      const {
        mealType = 'lunch',
        description,
        calories = 0,
        protein = 0,
        fats = 0,
        carbs = 0,
        recipeUrl,
      } = data;

      const mealLabel = MEAL_LABELS[mealType] || 'Прием пищи';

      const lines: string[] = [
        '<b>🥗 Прием пищи сохранен с сайта!</b>',
        '',
        `🍽 <b>Прием:</b> ${escapeHtml(mealLabel)}`,
        `🥣 <b>Рацион:</b> ${escapeHtml(description)}`,
        '',
        '📊 <b>КБЖУ этого приема:</b>',
        `• 🔥 Калории: <b>${Math.round(calories)} ккал</b>`,
        `• 🥩 Белки: <b>${protein} г</b>`,
        `• 🥑 Жиры: <b>${fats} г</b>`,
        `• 🍚 Углеводы: <b>${carbs} г</b>`,
      ];

      if (profile.daily_calories_goal) {
        const calPercent = Math.min(
          100,
          Math.round((calories / profile.daily_calories_goal) * 100)
        );
        lines.push(`• 📈 Доля от суточной нормы (${profile.daily_calories_goal} ккал): <b>~${calPercent}%</b>`);
      }

      if (recipeUrl) {
        lines.push('');
        lines.push(`🔗 <b>Рецепт:</b> <a href="${escapeHtml(recipeUrl)}">${escapeHtml(recipeUrl)}</a>`);
      }

      messageHtml = lines.join('\n');
    } else {
      return NextResponse.json(
        { ok: false, error: 'Неизвестный тип уведомления' },
        { status: 400 }
      );
    }

    // Отправляем красивое HTML-сообщение в личный чат Telegram
    await bot.api.sendMessage(profile.telegram_id, messageHtml, {
      parse_mode: 'HTML',
      reply_markup: inlineKb,
      link_preview_options: { is_disabled: true },
    });

    return NextResponse.json({ ok: true, sent: true });
  } catch (error) {
    console.error('[Telegram Notify Error]:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Ошибка отправки',
      },
      { status: 500 }
    );
  }
}
