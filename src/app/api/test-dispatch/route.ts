import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (secret !== 'djamaat0511') {
    return NextResponse.json({ ok: false, error: 'Доступ запрещен' }, { status: 403 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN || '9103088593:AAHZojPEMQmXz7KjycHxplYJKwqiJG5LvfU';
  const chatId = searchParams.get('chat_id') || '483395113';

  const results: Record<string, unknown> = {};

  try {
    // 1. Проверяем getMe
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    results.botInfo = await meRes.json();

    // 2. Отправляем тренировку
    const workoutHtml = [
      '<b>🏋️‍♂️ Новая тренировка сохранена с сайта!</b>',
      '',
      '📅 <b>Дата:</b> 30.10.2026',
      '🏷 <b>Сплит:</b> Грудь + Трицепс',
      '🔥 <b>Общий тоннаж:</b> 3 600 кг',
      '❤️ <b>Самочувствие:</b> 9 / 10',
      '💭 <b>Заметка:</b> <i>Тестовая проверка: жим штанги шел отлично</i>',
      '',
      '📋 <b>Упражнения и подходы:</b>',
      '1. <b>Жим штанги лежа</b>: 80 кг × 4 подх. × 8 повт. (2 560 кг)',
      '2. <b>Французский жим</b>: 30 кг × 3 подх. × 10 повт. (900 кг)',
      '3. <b>Разводка гантелей</b>: 14 кг × 3 подх. × 12 повт.'
    ].join('\n');

    const wRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: workoutHtml,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📱 Открыть в Ежедневнике', web_app: { url: 'https://euphonious-florentine-dc3699.netlify.app/' } }]
          ]
        }
      })
    });
    results.workoutMessage = await wRes.json();

    // 3. Отправляем чтение Корана
    const quranHtml = [
      '<b>🕋 Прогресс чтения Корана обновлен!</b>',
      '',
      '🕋 <b>Название:</b> «Сура 18 Аль-Кахф»',
      '📄 <b>Прогресс:</b> 25 из 110 аят / стр. (<b>22.7%</b>)',
      '<code>[███░░░░░░░░░] 22.7%</code>',
      '',
      '📝 <b>Заметки / Тадаббур:</b>\n<i>Размышление над аятом о юношах в пещере</i>',
      '',
      '🔗 <b>Ссылки на материалы:</b>\n• <a href="https://quran.com/18/25">https://quran.com/18/25</a>'
    ].join('\n');

    const qRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: quranHtml,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📱 Открыть в Ежедневнике', web_app: { url: 'https://euphonious-florentine-dc3699.netlify.app/reading' } }]
          ]
        }
      })
    });
    results.quranMessage = await qRes.json();

    // 4. Отправляем прием пищи (питание)
    const nutritionHtml = [
      '<b>🥗 Прием пищи сохранен с сайта!</b>',
      '',
      '🍽 <b>Прием:</b> Обед 🍲',
      '🥣 <b>Рацион:</b> Овсяные хлопья 70г, Яйца куриные 120г, Банан 100г',
      '',
      '📊 <b>КБЖУ этого приема:</b>',
      '• 🔥 Калории: <b>450 ккал</b>',
      '• 🥩 Белки: <b>28 г</b>',
      '• 🥑 Жиры: <b>14 г</b>',
      '• 🍚 Углеводы: <b>55 г</b>',
      '• 📈 Доля от суточной нормы (2200 ккал): <b>~20%</b>'
    ].join('\n');

    const nRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: nutritionHtml,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📱 Открыть в Ежедневнике', web_app: { url: 'https://euphonious-florentine-dc3699.netlify.app/nutrition' } }]
          ]
        }
      })
    });
    results.nutritionMessage = await nRes.json();

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : 'Ошибка'
    }, { status: 500 });
  }
}
