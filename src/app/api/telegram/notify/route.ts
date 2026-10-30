import { NextResponse } from 'next/server';
import { InlineKeyboard, InputFile } from 'grammy';
import type { SupabaseClient } from '@supabase/supabase-js';
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

function renderAsciiBar(percent: number, length = 10): string {
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

/**
 * Скачивает бинарный буфер изображения из Supabase Storage (или декодирует base64)
 * для гарантированной прямой multipart-отправки в Telegram через InputFile.
 */
async function downloadStorageBuffer(
  supabase: SupabaseClient,
  rawRef: string
): Promise<{ buffer: Buffer; fileName: string } | null> {
  if (!rawRef) return null;

  // Обработка base64 data-URL
  if (rawRef.startsWith('data:image/')) {
    try {
      const match = rawRef.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        const ext = match[1].split('/')[1] || 'jpg';
        return {
          buffer: Buffer.from(match[2], 'base64'),
          fileName: `screenshot.${ext}`,
        };
      }
    } catch {
      return null;
    }
  }

  if (rawRef.startsWith('http://') || rawRef.startsWith('https://') || rawRef.startsWith('blob:')) {
    return null;
  }

  let bucket = 'quran-pages';
  let objectPath = rawRef;

  if (rawRef.startsWith('workout-photos/')) {
    bucket = 'workout-photos';
    objectPath = rawRef.replace(/^workout-photos\//, '');
  } else if (rawRef.startsWith('quran-pages/')) {
    bucket = 'quran-pages';
    objectPath = rawRef.replace(/^quran-pages\//, '');
  } else if (rawRef.startsWith('diary-media/')) {
    bucket = 'diary-media';
    objectPath = rawRef.replace(/^diary-media\//, '');
  }

  try {
    const { data, error } = await supabase.storage.from(bucket).download(objectPath);
    if (error || !data) {
      console.warn(`[downloadStorageBuffer] Storage download failed for ${bucket}/${objectPath}:`, error?.message);
      return null;
    }
    const arrayBuffer = await data.arrayBuffer();
    const fileName = objectPath.split('/').pop() || 'photo.jpg';
    return { buffer: Buffer.from(arrayBuffer), fileName };
  } catch (err) {
    console.warn('[downloadStorageBuffer exception]:', err);
    return null;
  }
}

/**
 * Получает временный Signed URL для файла из Supabase Storage
 */
async function resolveStorageSignedUrl(
  supabase: SupabaseClient,
  rawRef: string
): Promise<string | null> {
  if (!rawRef) return null;
  if (rawRef.startsWith('http://') || rawRef.startsWith('https://')) {
    return rawRef;
  }
  if (rawRef.startsWith('blob:') || rawRef.startsWith('data:')) {
    return null;
  }

  let bucket = 'quran-pages';
  let objectPath = rawRef;

  if (rawRef.startsWith('workout-photos/')) {
    bucket = 'workout-photos';
    objectPath = rawRef.replace(/^workout-photos\//, '');
  } else if (rawRef.startsWith('quran-pages/')) {
    bucket = 'quran-pages';
    objectPath = rawRef.replace(/^quran-pages\//, '');
  } else if (rawRef.startsWith('diary-media/')) {
    bucket = 'diary-media';
    objectPath = rawRef.replace(/^diary-media\//, '');
  }

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(objectPath, 3600); // 1 час действия

    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { type, data, userId: explicitUserId } = body;

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

    const supabase = createSupabaseAdminClient();

    let targetTelegramId: number | null = null;
    let displayName = 'Пользователь';
    let dailyCaloriesGoal: number | null = null;

    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('telegram_id, display_name, daily_calories_goal')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.telegram_id) {
        targetTelegramId = profile.telegram_id;
      }
      if (profile?.display_name) displayName = profile.display_name;
      if (profile?.daily_calories_goal) dailyCaloriesGoal = profile.daily_calories_goal;
    }

    // Если telegram_id не найден в профиле, используем привязанный ID пользователя из настроек
    if (!targetTelegramId) {
      const { data: anyLinked } = await supabase
        .from('profiles')
        .select('telegram_id')
        .not('telegram_id', 'is', null)
        .limit(1)
        .maybeSingle();

      if (anyLinked?.telegram_id) {
        targetTelegramId = anyLinked.telegram_id;
      } else {
        // Дефолтный Telegram ID владельца
        targetTelegramId = 483395113;
      }

      // Привязываем telegram_id к профилю, если есть userId
      if (userId && targetTelegramId) {
        try {
          await supabase
            .from('profiles')
            .update({ telegram_id: targetTelegramId })
            .eq('id', userId);
        } catch {
          // ignore
        }
      }
    }

    if (!targetTelegramId) {
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
    let targetPhotoRef: string | null = null;

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
        photoUrls = [],
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

      if (photoUrls && photoUrls.length > 0) {
        targetPhotoRef = photoUrls[0];
        lines.push(`📸 <b>Фото формы:</b> прикреплено (${photoUrls.length} шт.)`);
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
        mediaUrls = [],
        isNewScreenshot = false,
      } = data;

      const isQuran = category === 'quran';
      const unit = isQuran ? 'аят' : 'стр.';
      const icon = isQuran ? '🕋' : '📖';
      const header = isNewScreenshot
        ? (isQuran ? '<b>📸 Скриншот страницы Корана сохранен!</b>' : '<b>📸 Скриншот книги сохранен!</b>')
        : (isQuran ? '<b>🕋 Прогресс чтения Корана обновлен!</b>' : '<b>📖 Прогресс книги сохранен!</b>');

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

      // Определение скриншота для отправки
      if (data.photoUrl) {
        targetPhotoRef = data.photoUrl;
      } else if (data.mediaUrl) {
        targetPhotoRef = data.mediaUrl;
      } else if (mediaUrls && mediaUrls.length > 0) {
        targetPhotoRef = mediaUrls[mediaUrls.length - 1]; // Последний прикрепленный скриншот
      }

      if (targetPhotoRef) {
        lines.push(`📸 <b>Скриншот:</b> прикреплен к карточке`);
      }

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
    // 3. УВЕДОМЛЕНИЕ О ПРИЕМЕ ПИЩИ (NUTRITION)
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
        photoUrl,
      } = data;

      const mealLabel = MEAL_LABELS[mealType] || 'Прием пищи';

      if (photoUrl) {
        targetPhotoRef = photoUrl;
      }

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

      if (dailyCaloriesGoal) {
        const calPercent = Math.min(
          100,
          Math.round((calories / dailyCaloriesGoal) * 100)
        );
        lines.push(`• 📈 Доля от суточной нормы (${dailyCaloriesGoal} ккал): <b>~${calPercent}%</b>`);
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

    // =========================================================================
    // ОТПРАВКА В TELEGRAM: ПРИОРИТЕТ 1 - ПРЯМОЙ INPUTFILE BUFFER, 2 - SIGNED URL, 3 - TEXT
    // =========================================================================
    let photoSent = false;
    if (targetPhotoRef) {
      // 1. Прямая загрузка бинарного буфера из Supabase Storage и отправка через multipart InputFile
      const downloaded = await downloadStorageBuffer(supabase, targetPhotoRef);
      if (downloaded) {
        try {
          const inputFile = new InputFile(downloaded.buffer, downloaded.fileName);
          if (messageHtml.length <= 1024) {
            await bot.api.sendPhoto(targetTelegramId, inputFile, {
              caption: messageHtml,
              parse_mode: 'HTML',
              reply_markup: inlineKb,
            });
            photoSent = true;
          } else {
            const shortCaption = messageHtml.slice(0, 950) + '...';
            await bot.api.sendPhoto(targetTelegramId, inputFile, {
              caption: shortCaption,
              parse_mode: 'HTML',
            });
            await bot.api.sendMessage(targetTelegramId, messageHtml, {
              parse_mode: 'HTML',
              reply_markup: inlineKb,
              link_preview_options: { is_disabled: true },
            });
            photoSent = true;
          }
        } catch (inputErr) {
          console.error('[Telegram sendPhoto InputFile failed]:', inputErr);
        }
      }

      // 2. Если скачивание буфера не удалось — пробуем через signedUrl
      if (!photoSent) {
        const signedUrl = await resolveStorageSignedUrl(supabase, targetPhotoRef);
        if (signedUrl) {
          try {
            if (messageHtml.length <= 1024) {
              await bot.api.sendPhoto(targetTelegramId, signedUrl, {
                caption: messageHtml,
                parse_mode: 'HTML',
                reply_markup: inlineKb,
              });
              photoSent = true;
            } else {
              const shortCaption = messageHtml.slice(0, 950) + '...';
              await bot.api.sendPhoto(targetTelegramId, signedUrl, {
                caption: shortCaption,
                parse_mode: 'HTML',
              });
              await bot.api.sendMessage(targetTelegramId, messageHtml, {
                parse_mode: 'HTML',
                reply_markup: inlineKb,
                link_preview_options: { is_disabled: true },
              });
              photoSent = true;
            }
          } catch (photoErr) {
            console.error('[Telegram sendPhoto URL failed]:', photoErr);
          }
        }
      }
    }

    // 3. Если фото не было или не отправилось — отправляем стандартное текстовое HTML-сообщение
    if (!photoSent) {
      await bot.api.sendMessage(targetTelegramId, messageHtml, {
        parse_mode: 'HTML',
        reply_markup: inlineKb,
        link_preview_options: { is_disabled: true },
      });
    }

    return NextResponse.json({ ok: true, sent: true, withPhoto: photoSent });
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
