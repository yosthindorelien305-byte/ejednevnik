import { NextResponse } from 'next/server';
import { webhookCallback } from 'grammy';
import { getTelegramBot } from '@/lib/telegram/bot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/telegram/webhook
 * Принимает обновления от серверов Telegram и проверяет заголовок X-Telegram-Bot-Api-Secret-Token.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const bot = getTelegramBot();
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;

    const handleUpdate = webhookCallback(bot, 'std/http', {
      timeoutMilliseconds: 25_000,
      secretToken: secretToken || undefined,
    });

    return await handleUpdate(request);
  } catch (error) {
    console.error('[Telegram Webhook Error]:', error);
    return NextResponse.json(
      { ok: false, error: 'Внутренняя ошибка обработки вебхука' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/telegram/webhook?setup=1&secret=<TELEGRAM_WEBHOOK_SECRET>
 * Одноразовый сервисный маршрут для регистрации вебхука, команд и глобальной кнопки Web App.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const isSetup = searchParams.get('setup') === '1';
  const providedSecret = searchParams.get('secret');
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!isSetup) {
    return NextResponse.json({ status: 'Telegram webhook endpoint active' });
  }

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json(
      { ok: false, error: 'Неверный секретный токен' },
      { status: 401 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return NextResponse.json(
      { ok: false, error: 'Не задан NEXT_PUBLIC_APP_URL' },
      { status: 400 }
    );
  }

  const bot = getTelegramBot();
  const webhookUrl = `${appUrl.replace(/\/$/, '')}/api/telegram/webhook`;

  // 1. Регистрируем HTTPS-вебхук с проверкой секретного заголовка
  await bot.api.setWebhook(webhookUrl, {
    secret_token: expectedSecret,
    allowed_updates: ['message', 'callback_query'],
  });

  // 2. Устанавливаем список подсказок команд в меню бота
  await bot.api.setMyCommands([
    { command: 'start', description: 'Запуск бота и привязка sync_token' },
    { command: 'status', description: 'Где я остановился? (актуальный прогресс)' },
    {
      command: 'workout',
      description: 'Записать тренировку (напр. /workout Жим 80x4, Присед 100x4)',
    },
  ]);

  // 3. Глобально устанавливаем кнопку запуска Web App внизу чата для всех пользователей
  await bot.api.setChatMenuButton({
    menu_button: {
      type: 'web_app',
      text: 'Открыть Ежедневник',
      web_app: { url: appUrl },
    },
  });

  return NextResponse.json({
    ok: true,
    webhookUrl,
    message: 'Вебхук, команды и кнопка Web App успешно зарегистрированы',
  });
}
