/**
 * Звуковой синтезатор окончания отдыха через Web Audio API.
 * Воспроизводит приятный тройной аккорд без сторонних mp3 файлов,
 * работает оффлайн и внутри Telegram WebApp.
 */
export function playRestTimerCompletedSound(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // 3 благородных тона: C5 (523.25 Hz), E5 (659.25 Hz), G5 (783.99 Hz)
    const tones = [523.25, 659.25, 783.99];

    tones.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);

      // Плавное нарастание и затухание для мягкого премиального звучания
      gain.gain.setValueAtTime(0.001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.22, now + idx * 0.14 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.38);
    });
  } catch {
    // В случае отключенного звука в браузере не прерываем работу
  }
}
