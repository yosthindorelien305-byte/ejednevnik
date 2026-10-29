import { Bot, InlineKeyboard, Keyboard, type Context } from 'grammy';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  parseWorkoutCommand,
  getTodayInTimezone,
} from '@/features/telegram-sync/utils/workoutCommandParser';
import { parseNaturalLanguageMessage } from '@/features/telegram-sync/utils/naturalLanguageParser';

interface UserProfileRow {
  id: string;
  display_name: string | null;
  timezone: string;
  daily_calories_goal: number;
}

type MediaTarget = 'workout' | 'quran' | 'book';

let botInstance: Bot | null = null;

function getWebAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://example.com';
}

function buildMainKeyboard(): Keyboard {
  return new Keyboard()
    .webApp('📱 Открыть Ежедневник', getWebAppUrl())
    .row()
    .text('Где я остановился?')
    .resized()
    .persistent();
}

function buildInlineWebAppButton(): InlineKeyboard {
  return new InlineKeyboard().webApp('📱 Открыть на сайте', getWebAppUrl());
}

// Поиск пользователя в таблице profiles по telegram_id
async function getProfileByTelegramId(
  telegramId: number
): Promise<UserProfileRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, timezone, daily_calories_goal')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (error || !data) return null;
  return data as UserProfileRow;
}

// Скачивание фото с серверов Telegram и сохранение в соответствующий бакет Supabase Storage
async function uploadTelegramPhotoToBucket(params: {
  ctx: Context;
  fileId: string;
  bucket: 'workout-photos' | 'quran-pages' | 'diary-media';
  storagePath: string;
}): Promise<string> {
  const { ctx, fileId, bucket, storagePath } = params;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error('Не задан TELEGRAM_BOT_TOKEN');

  const tgFile = await ctx.api.getFile(fileId);
  if (!tgFile.file_path) {
    throw new Error('Telegram API не вернул file_path изображения');
  }

  const fileResponse = await fetch(
    `https://api.telegram.org/file/bot${botToken}/${tgFile.file_path}`
  );
  if (!fileResponse.ok) {
    throw new Error(`Ошибка скачивания файла из Telegram (${fileResponse.status})`);
  }

  const buffer = await fileResponse.arrayBuffer();
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) {
    throw new Error(`Ошибка Supabase Storage: ${error.message}`);
  }

  return `${bucket}/${storagePath}`;
}

// Прикрепление загруженного фото к профилю пользователя (тренировки или книги/Коран)
async function savePhotoAndAttachToUser(params: {
  ctx: Context;
  profile: UserProfileRow;
  fileId: string;
  caption: string;
  target: MediaTarget;
}): Promise<string> {
  const { ctx, profile, fileId, caption, target } = params;
  const supabase = createSupabaseAdminClient();
  const today = getTodayInTimezone(profile.timezone);
  const yearMonth = today.slice(0, 7);
  const fileUuid = crypto.randomUUID();

  if (target === 'workout') {
    const objectPath = `${profile.id}/${yearMonth}/${fileUuid}.jpg`;
    const fullRef = await uploadTelegramPhotoToBucket({
      ctx,
      fileId,
      bucket: 'workout-photos',
      storagePath: objectPath,
    });

    // Находим сегодняшнюю тренировку пользователя или создаем новую, чтобы прикрепить фото в photo_urls
    const { data: existingWorkout } = await supabase
      .from('workouts')
      .select('id, photo_urls, notes')
      .eq('user_id', profile.id)
      .eq('workout_date', today)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const cleanNote = caption
      .replace(/^#?(?:форма|тренировка)(?=$|[\s:,-])/i, '')
      .trim();

    if (existingWorkout) {
      const nextPhotos = [...(existingWorkout.photo_urls ?? []), fullRef];
      const nextNotes = cleanNote
        ? [existingWorkout.notes, cleanNote].filter(Boolean).join('\n')
        : existingWorkout.notes;

      const { error } = await supabase
        .from('workouts')
        .update({
          photo_urls: nextPhotos,
          notes: nextNotes,
          last_updated_by: 'telegram',
        })
        .eq('id', existingWorkout.id);

      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from('workouts').insert({
        user_id: profile.id,
        workout_date: today,
        title: 'Фото прогресса формы',
        notes: cleanNote || null,
        photo_urls: [fullRef],
        last_updated_by: 'telegram',
      });
      if (error) throw new Error(error.message);
    }

    return `💪 Фото формы загружено в бакет workout-photos и прикреплено к тренировке за ${today}!`;
  }

  // Для скриншота страницы книги или Корана: загружаем в бакет quran-pages и обновляем media_urls в books_and_quran
  const category = target === 'quran' ? 'quran' : 'book';
  const objectPath = `${profile.id}/${category}/${yearMonth}/${fileUuid}.jpg`;
  const fullRef = await uploadTelegramPhotoToBucket({
    ctx,
    fileId,
    bucket: 'quran-pages',
    storagePath: objectPath,
  });

  // Проверяем, не указал ли пользователь в подписи к фото точную страницу книги или аят Корана
  const captionIntent = caption ? parseNaturalLanguageMessage(caption) : null;

  if (captionIntent?.kind === 'quran_progress') {
    const { data: existingSurah } = await supabase
      .from('books_and_quran')
      .select('id, title, total_target, media_urls')
      .eq('user_id', profile.id)
      .eq('category', 'quran')
      .ilike('title', captionIntent.title)
      .limit(1)
      .maybeSingle();

    if (existingSurah) {
      const { error } = await supabase
        .from('books_and_quran')
        .update({
          current_position: captionIntent.ayahPosition,
          total_target: Math.max(
            existingSurah.total_target,
            captionIntent.ayahPosition
          ),
          media_urls: [...(existingSurah.media_urls ?? []), fullRef],
          last_updated_by: 'telegram',
        })
        .eq('id', existingSurah.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from('books_and_quran').insert({
        user_id: profile.id,
        category: 'quran',
        title: captionIntent.title,
        current_position: captionIntent.ayahPosition,
        total_target: captionIntent.totalTarget,
        media_urls: [fullRef],
        last_updated_by: 'telegram',
      });
      if (error) throw new Error(error.message);
    }

    return `🕋 Скриншот сохранен и прикреплен: ${captionIntent.title}, аят ${captionIntent.ayahPosition}!`;
  }

  if (captionIntent?.kind === 'book_progress') {
    const { data: existingBook } = await supabase
      .from('books_and_quran')
      .select('id, title, current_position, total_target, media_urls')
      .eq('user_id', profile.id)
      .eq('category', 'book')
      .ilike('title', `%${captionIntent.title}%`)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingBook) {
      const nextPos = captionIntent.isRelativeDelta
        ? existingBook.current_position + captionIntent.position
        : captionIntent.position;
      const nextTotal = Math.max(
        captionIntent.explicitTotalPages ?? existingBook.total_target,
        nextPos
      );
      const { error } = await supabase
        .from('books_and_quran')
        .update({
          current_position: nextPos,
          total_target: nextTotal,
          media_urls: [...(existingBook.media_urls ?? []), fullRef],
          last_updated_by: 'telegram',
        })
        .eq('id', existingBook.id);
      if (error) throw new Error(error.message);

      return `📖 Скриншот прикреплен к «${existingBook.title}» (стр. ${nextPos} из ${nextTotal})!`;
    }
  }

  const cleanCaption = caption
    .replace(/^#?(?:коран|сура|книга|страница|скриншот)(?=$|[\s:,-])/i, '')
    .trim();

  // Ищем последнюю активную запись соответствующей категории ('book' или 'quran')
  const { data: latestItem } = await supabase
    .from('books_and_quran')
    .select('id, title, media_urls, notes')
    .eq('user_id', profile.id)
    .eq('category', category)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestItem) {
    const nextMedia = [...(latestItem.media_urls ?? []), fullRef];
    const nextNotes = cleanCaption
      ? [latestItem.notes, cleanCaption].filter(Boolean).join('\n')
      : latestItem.notes;

    const { error } = await supabase
      .from('books_and_quran')
      .update({
        media_urls: nextMedia,
        notes: nextNotes,
        last_updated_by: 'telegram',
      })
      .eq('id', latestItem.id);

    if (error) throw new Error(error.message);

    return `${
      category === 'quran' ? '🕋' : '📖'
    } Скриншот страницы сохранен и прикреплен к «${latestItem.title}»!`;
  }

  // Если у пользователя еще не было ни одной книги/суры — создаем запись со скриншотом
  const defaultTitle = category === 'quran' ? 'Сура 1' : 'Моя книга';
  const defaultTarget = category === 'quran' ? 7 : 300;

  const { error } = await supabase.from('books_and_quran').insert({
    user_id: profile.id,
    category,
    title: defaultTitle,
    current_position: 1,
    total_target: defaultTarget,
    notes: cleanCaption || null,
    media_urls: [fullRef],
    last_updated_by: 'telegram',
  });

  if (error) throw new Error(error.message);

  return `${
    category === 'quran' ? '🕋' : '📖'
  } Скриншот страницы сохранен в хранилище (${defaultTitle})!`;
}

// Склонение слова «подход» по числительному (1 подход, 4 подхода, 5 подходов)
function pluralizeSets(count: number): string {
  const mod100 = Math.abs(count) % 100;
  const mod10 = mod100 % 10;
  if (mod100 > 10 && mod100 < 20) return 'подходов';
  if (mod10 > 1 && mod10 < 5) return 'подхода';
  if (mod10 === 1) return 'подход';
  return 'подходов';
}

// Формирование ответа на /status или вопрос «Где я остановился?»
async function buildAndSendProgressStatus(
  ctx: Context,
  profile: UserProfileRow
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const today = getTodayInTimezone(profile.timezone);

  const [bookRes, quranRes, todayWorkoutsRes, todayNutritionRes] =
    await Promise.all([
      supabase
        .from('books_and_quran')
        .select('title, current_position, total_target, progress_percent')
        .eq('user_id', profile.id)
        .eq('category', 'book')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('books_and_quran')
        .select('title, current_position, total_target')
        .eq('user_id', profile.id)
        .eq('category', 'quran')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('workouts')
        .select('id, title, total_tonnage, workout_sets(exercise_name, sets_count, reps)')
        .eq('user_id', profile.id)
        .eq('workout_date', today),
      supabase
        .from('nutrition_logs')
        .select('calories')
        .eq('user_id', profile.id)
        .eq('meal_date', today),
    ]);

  // 1. Строка по книге
  const book = bookRes.data;
  const bookPct = book
    ? Math.round(
        Number(
          book.progress_percent ??
            (book.current_position / Math.max(1, book.total_target)) * 100
        )
      )
    : 0;
  const bookLine = book
    ? `📖 Книга "${book.title}": страница ${book.current_position} из ${book.total_target} (${bookPct}%)`
    : '📖 Книга: активное чтение еще не начато';

  // 2. Строка по Корану
  const quran = quranRes.data;
  const quranLine = quran
    ? `🕋 Коран: ${quran.title}, аят ${quran.current_position}`
    : '🕋 Коран: позиция еще не отмечена';

  // 3. Строка по сегодняшней тренировке
  const workouts = (todayWorkoutsRes.data ?? []) as Array<{
    id: string;
    title: string;
    total_tonnage: number;
    workout_sets?: Array<{
      exercise_name: string;
      sets_count: number;
      reps: number;
    }>;
  }>;

  let workoutLine = '💪 Тренировка сегодня: пока не записана';
  if (workouts.length > 0) {
    const allSets = workouts.flatMap((w) => w.workout_sets ?? []);
    if (allSets.length > 0) {
      const totalSetsCount = allSets.reduce(
        (sum, s) => sum + Number(s.sets_count || 1),
        0
      );
      const setsWord = pluralizeSets(totalSetsCount);
      const firstExercise = allSets[0].exercise_name.toLowerCase();
      const suffix =
        allSets.length === 1
          ? `${totalSetsCount} ${setsWord} (${firstExercise}) записано`
          : `${totalSetsCount} ${setsWord} (${allSets.length} упр.) записано`;
      workoutLine = `💪 Тренировка сегодня: ${suffix}`;
    } else {
      workoutLine = `💪 Тренировка сегодня: ${workouts[0].title} зафиксирована`;
    }
  }

  // 4. Строка по питанию за сегодня
  const totalCalories = Math.round(
    (todayNutritionRes.data ?? []).reduce(
      (sum, row) => sum + Number(row.calories || 0),
      0
    )
  );
  const nutritionLine =
    totalCalories > 0
      ? `🍏 Питание: ${totalCalories} ккал зафиксировано`
      : '🍏 Питание: сегодня еще 0 ккал';

  const statusText = [bookLine, quranLine, workoutLine, nutritionLine].join('\n');

  await ctx.reply(statusText, {
    reply_markup: buildInlineWebAppButton(),
  });
}

// Запись тренировки и силовых подходов в таблицы workouts и workout_sets
async function recordWorkoutExercises(params: {
  profile: UserProfileRow;
  exercises: Array<{
    exerciseName: string;
    workingWeight: number;
    setsCount: number;
    repsCount: number;
    tonnage: number;
  }>;
}): Promise<string> {
  const { profile, exercises } = params;
  const supabase = createSupabaseAdminClient();
  const today = getTodayInTimezone(profile.timezone);

  const { data: workout, error: wErr } = await supabase
    .from('workouts')
    .insert({
      user_id: profile.id,
      workout_date: today,
      title: 'Тренировка из Telegram',
      last_updated_by: 'telegram',
    })
    .select('id')
    .single();

  if (wErr || !workout) {
    throw new Error(wErr?.message ?? 'Не удалось создать тренировку');
  }

  const setsPayload = exercises.map((ex) => ({
    workout_id: workout.id,
    user_id: profile.id,
    exercise_name: ex.exerciseName,
    sets_count: ex.setsCount,
    reps: ex.repsCount,
    weight_kg: ex.workingWeight,
  }));

  const { error: sErr } = await supabase.from('workout_sets').insert(setsPayload);
  if (sErr) throw new Error(sErr.message);

  const totalTonnage = exercises.reduce((sum, e) => sum + e.tonnage, 0);
  const details = exercises
    .map(
      (e) =>
        `• ${e.exerciseName}: ${e.workingWeight} кг × ${e.setsCount}×${e.repsCount} (${e.tonnage} кг)`
    )
    .join('\n');

  return `💪 Тренировка сохранена!\n${details}\n🔥 Общий тоннаж: ${totalTonnage} кг`;
}

// Инициализация синглтона бота grammY
export function getTelegramBot(): Bot {
  if (botInstance) return botInstance;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('Не задана переменная окружения TELEGRAM_BOT_TOKEN');
  }

  const bot = new Bot(token);

  // Команда /start и привязка через код синхронизации (/start <sync_token>)
  bot.command('start', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const syncCode = ctx.match?.trim();

    if (ctx.chat?.id) {
      await ctx.api
        .setChatMenuButton({
          chat_id: ctx.chat.id,
          menu_button: {
            type: 'web_app',
            text: 'Открыть Ежедневник',
            web_app: { url: getWebAppUrl() },
          },
        })
        .catch(() => null);
    }

    if (syncCode) {
      const supabase = createSupabaseAdminClient();
      const { data: linkedUserId, error } = await supabase.rpc(
        'link_telegram_by_sync_token',
        {
          p_sync_token: syncCode,
          p_telegram_id: telegramId,
        }
      );

      if (error || !linkedUserId) {
        await ctx.reply(
          '⚠️ Код привязки не найден или уже был использован. Проверьте актуальный sync_token в профиле на сайте.',
          { reply_markup: buildMainKeyboard() }
        );
        return;
      }

      await ctx.reply(
        [
          '✅ Профиль iPhone и Telegram успешно синхронизированы!',
          '',
          'Пишите мне в свободной форме:',
          '• «Прочитал 45 страниц книги Атомные привычки»',
          '• «Коран 2 сура 15 аят»',
          '• Отправьте ссылку с комментарием или фото страницы / формы',
          '• Спросите «Где я остановился?» или нажмите /status',
        ].join('\n'),
        { reply_markup: buildMainKeyboard() }
      );
      return;
    }

    const profile = await getProfileByTelegramId(telegramId);
    if (profile) {
      await ctx.reply(
        '👋 Бот готов к работе! Напишите прогресс чтения, пришлите фото/ссылку или спросите «Где я остановился?».',
        { reply_markup: buildMainKeyboard() }
      );
    } else {
      await ctx.reply(
        '👋 Добро пожаловать!\nСкопируйте ваш код привязки (sync_token) на сайте и отправьте команду:\n/start ВАШ_КОД',
        { reply_markup: buildMainKeyboard() }
      );
    }
  });

  // Команды /status и /stats
  bot.command(['status', 'stats'], async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const profile = await getProfileByTelegramId(telegramId);
    if (!profile) {
      await ctx.reply('🔒 Сначала привяжите профиль командой /start ВАШ_КОД.');
      return;
    }

    await buildAndSendProgressStatus(ctx, profile);
  });

  // Команда /workout Жим 80x4, Присед 100x4
  bot.command('workout', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const profile = await getProfileByTelegramId(telegramId);
    if (!profile) {
      await ctx.reply('🔒 Сначала привяжите профиль командой /start ВАШ_КОД.');
      return;
    }

    const exercises = parseWorkoutCommand(ctx.match ?? '');
    if (exercises.length === 0) {
      await ctx.reply('Пример: /workout Жим 80x4, Присед 100x4');
      return;
    }

    try {
      const replyText = await recordWorkoutExercises({ profile, exercises });
      await ctx.reply(replyText, { reply_markup: buildInlineWebAppButton() });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка записи';
      await ctx.reply(`❌ ${msg}`);
    }
  });

  // Прием фото (скриншоты страниц книги/Корана и фото формы)
  bot.on('message:photo', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const profile = await getProfileByTelegramId(telegramId);
    if (!profile) {
      await ctx.reply('🔒 Сначала привяжите профиль командой /start ВАШ_КОД.');
      return;
    }

    const photos = ctx.message.photo;
    const largestPhoto = photos[photos.length - 1];
    const caption = (ctx.message.caption ?? '').trim();

    // Автоопределение типа фото по ключевым словам в подписи
    let target: MediaTarget | null = null;
    if (/(?:форма|тренировка|вес|зал)/i.test(caption)) {
      target = 'workout';
    } else if (/(?:коран|сура|аят|тадаббур)/i.test(caption)) {
      target = 'quran';
    } else if (/(?:книг|страниц|стр\.?|глава|цитат)/i.test(caption)) {
      target = 'book';
    }

    if (target) {
      try {
        const resMessage = await savePhotoAndAttachToUser({
          ctx,
          profile,
          fileId: largestPhoto.file_id,
          caption,
          target,
        });
        await ctx.reply(resMessage, { reply_markup: buildInlineWebAppButton() });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Ошибка сохранения фото';
        await ctx.reply(`❌ ${msg}`);
      }
      return;
    }

    // Если подписи нет — уточняем раздел одной кнопкой
    const kb = new InlineKeyboard()
      .text('💪 Фото формы', 'photo_save:workout')
      .row()
      .text('🕋 Скриншот Корана', 'photo_save:quran')
      .text('📖 Скриншот книги', 'photo_save:book');

    await ctx.reply('В какой раздел прикрепить этот снимок?', {
      reply_parameters: { message_id: ctx.message.message_id },
      reply_markup: kb,
    });
  });

  // Обработка выбора категории для фото без подписи
  bot.callbackQuery(/^photo_save:(workout|quran|book)$/, async (ctx) => {
    const target = ctx.match[1] as MediaTarget;
    const profile = await getProfileByTelegramId(ctx.from.id);

    if (!profile) {
      await ctx.answerCallbackQuery({
        text: 'Профиль не привязан',
        show_alert: true,
      });
      return;
    }

    const original = ctx.callbackQuery.message?.reply_to_message;
    const photos = original && 'photo' in original ? original.photo : undefined;

    if (!photos || photos.length === 0) {
      await ctx.answerCallbackQuery({
        text: 'Отправьте изображение повторно',
        show_alert: true,
      });
      return;
    }

    await ctx.answerCallbackQuery({ text: 'Сохраняю в Supabase Storage...' });

    try {
      const largest = photos[photos.length - 1];
      const caption =
        (original && 'caption' in original ? original.caption : '') ?? '';

      const resMessage = await savePhotoAndAttachToUser({
        ctx,
        profile,
        fileId: largest.file_id,
        caption,
        target,
      });

      await ctx.editMessageText(resMessage, {
        reply_markup: buildInlineWebAppButton(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка Storage';
      await ctx.editMessageText(`❌ ${msg}`);
    }
  });

  // Обработка сообщений на естественном языке (чтение, Коран, ссылки, вопросы о прогрессе)
  bot.on('message:text', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const text = ctx.message.text.trim();
    if (text.startsWith('/')) return;

    const profile = await getProfileByTelegramId(telegramId);
    if (!profile) {
      await ctx.reply(
        '🔒 Ваш Telegram еще не привязан к аккаунту.\nОтправьте команду: /start ВАШ_SYNC_TOKEN'
      );
      return;
    }

    const intent = parseNaturalLanguageMessage(text);
    const supabase = createSupabaseAdminClient();

    // 1. Вопрос «Где я остановился?»
    if (intent.kind === 'status_query') {
      await buildAndSendProgressStatus(ctx, profile);
      return;
    }

    // 2. Обновление прогресса чтения книги в таблице books_and_quran
    if (intent.kind === 'book_progress') {
      const { data: existingBook } = await supabase
        .from('books_and_quran')
        .select('id, title, current_position, total_target')
        .eq('user_id', profile.id)
        .eq('category', 'book')
        .ilike('title', `%${intent.title}%`)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingBook) {
        const nextPos = intent.isRelativeDelta
          ? existingBook.current_position + intent.position
          : intent.position;
        const nextTotal = Math.max(
          intent.explicitTotalPages ?? existingBook.total_target,
          nextPos
        );

        const { error } = await supabase
          .from('books_and_quran')
          .update({
            current_position: nextPos,
            total_target: nextTotal,
            last_updated_by: 'telegram',
          })
          .eq('id', existingBook.id);

        if (error) {
          await ctx.reply(`❌ Ошибка обновления книги: ${error.message}`);
          return;
        }

        const pct = Math.round((nextPos / nextTotal) * 100);
        await ctx.reply(
          `📖 Обновлено!\nКнига "${existingBook.title}": страница ${nextPos} из ${nextTotal} (${pct}%)`,
          { reply_markup: buildInlineWebAppButton() }
        );
        return;
      }

      // Если книга упоминается впервые — создаем запись в books_and_quran
      const initialTotal = Math.max(
        intent.explicitTotalPages ?? 300,
        intent.position
      );
      const { error } = await supabase.from('books_and_quran').insert({
        user_id: profile.id,
        category: 'book',
        title: intent.title,
        current_position: intent.position,
        total_target: initialTotal,
        last_updated_by: 'telegram',
      });

      if (error) {
        await ctx.reply(`❌ Ошибка добавления книги: ${error.message}`);
        return;
      }

      const pct = Math.round((intent.position / initialTotal) * 100);
      await ctx.reply(
        `📖 Добавлена книга "${intent.title}": страница ${intent.position} из ${initialTotal} (${pct}%)`,
        { reply_markup: buildInlineWebAppButton() }
      );
      return;
    }

    // 3. Обновление прогресса чтения Корана в таблице books_and_quran
    if (intent.kind === 'quran_progress') {
      const { data: existingSurah } = await supabase
        .from('books_and_quran')
        .select('id, title, total_target')
        .eq('user_id', profile.id)
        .eq('category', 'quran')
        .ilike('title', intent.title)
        .limit(1)
        .maybeSingle();

      if (existingSurah) {
        const safeTotal = Math.max(
          existingSurah.total_target,
          intent.ayahPosition
        );
        const { error } = await supabase
          .from('books_and_quran')
          .update({
            current_position: intent.ayahPosition,
            total_target: safeTotal,
            last_updated_by: 'telegram',
          })
          .eq('id', existingSurah.id);

        if (error) {
          await ctx.reply(`❌ Ошибка обновления Корана: ${error.message}`);
          return;
        }
      } else {
        const { error } = await supabase.from('books_and_quran').insert({
          user_id: profile.id,
          category: 'quran',
          title: intent.title,
          current_position: intent.ayahPosition,
          total_target: intent.totalTarget,
          last_updated_by: 'telegram',
        });

        if (error) {
          await ctx.reply(`❌ Ошибка записи Корана: ${error.message}`);
          return;
        }
      }

      await ctx.reply(
        `🕋 Записано!\nКоран: ${intent.title}, аят ${intent.ayahPosition} из ${intent.totalTarget}`,
        { reply_markup: buildInlineWebAppButton() }
      );
      return;
    }

    // 4. Сохранение полезной ссылки с комментарием
    if (intent.kind === 'useful_link') {
      // Записываем в общую базу полезных ссылок saved_links
      await supabase.from('saved_links').insert({
        user_id: profile.id,
        url: intent.url,
        comment: intent.comment || null,
        category: intent.category,
        last_updated_by: 'telegram',
      });

      // Если ссылка относится к чтению книги или Корану — также прикрепляем её в resource_urls активной записи
      if (intent.category === 'book' || intent.category === 'quran') {
        const { data: targetReading } = await supabase
          .from('books_and_quran')
          .select('id, resource_urls, notes')
          .eq('user_id', profile.id)
          .eq('category', intent.category)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (targetReading) {
          const nextUrls = Array.from(
            new Set([...(targetReading.resource_urls ?? []), intent.url])
          );
          await supabase
            .from('books_and_quran')
            .update({
              resource_urls: nextUrls,
              last_updated_by: 'telegram',
            })
            .eq('id', targetReading.id);
        }
      }

      await ctx.reply(
        `🔗 Ссылка сохранена в базу полезных материалов!\nКатегория: ${intent.category}${
          intent.comment ? `\n💬 Заметка: ${intent.comment}` : ''
        }`,
        { reply_markup: buildInlineWebAppButton() }
      );
      return;
    }

    // 5. Естественный ввод тренировки (например: «Жим 80x4, Присед 100x4»)
    if (intent.kind === 'workout_entry') {
      try {
        const msg = await recordWorkoutExercises({
          profile,
          exercises: intent.exercises,
        });
        await ctx.reply(msg, { reply_markup: buildInlineWebAppButton() });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Ошибка записи';
        await ctx.reply(`❌ ${msg}`);
      }
      return;
    }

    // 6. Естественный ввод питания (например: «Обед: куриная грудка 200г, гречка 180г»)
    if (intent.kind === 'nutrition_entry') {
      const today = getTodayInTimezone(profile.timezone);
      const { error } = await supabase.from('nutrition_logs').insert({
        user_id: profile.id,
        meal_date: today,
        meal_type: intent.mealType,
        food_description: intent.description,
        calories: intent.calories,
        protein: intent.protein,
        fats: intent.fats,
        carbs: intent.carbs,
        last_updated_by: 'telegram',
      });

      if (error) {
        await ctx.reply(`❌ Ошибка сохранения питания: ${error.message}`);
        return;
      }

      await ctx.reply(
        `🍏 Прием пищи сохранен!\n🔥 ${Math.round(intent.calories)} ккал` +
          (intent.protein > 0
            ? ` (Б: ${intent.protein}г · Ж: ${intent.fats}г · У: ${intent.carbs}г)`
            : ''),
        { reply_markup: buildInlineWebAppButton() }
      );
      return;
    }

    // Подсказка, если формат сообщения не распознан
    await ctx.reply(
      [
        '🤔 Не совсем понял сообщение. Попробуйте так:',
        '• «Прочитал 45 страниц книги Атомные привычки»',
        '• «Коран 2 сура 15 аят»',
        '• «Где я остановился?» или /status',
        '• «Жим 80x4, Присед 100x4»',
        '• Пришлите ссылку с комментарием или фото страницы / формы.',
      ].join('\n')
    );
  });

  botInstance = bot;
  return bot;
}
