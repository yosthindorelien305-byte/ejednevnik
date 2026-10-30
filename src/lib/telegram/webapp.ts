/**
 * Утилиты для работы с Telegram Mini App (Web App SDK):
 * - Автоматическое разворачивание на весь экран (expand);
 * - Нативный тактильный виброотклик iOS (HapticFeedback: impactOccurred, notificationOccurred);
 * - Безопасное определение наличия Telegram окружения.
 */

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: Record<string, unknown>;
        version?: string;
        platform?: string;
        colorScheme?: 'light' | 'dark';
        themeParams?: Record<string, string>;
        isExpanded?: boolean;
        viewportHeight?: number;
        viewportStableHeight?: number;
        headerColor?: string;
        backgroundColor?: string;
        expand: () => void;
        close: () => void;
        ready: () => void;
        HapticFeedback?: {
          impactOccurred: (
            style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
          ) => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
      };
    };
  }
}

/**
 * Разворачивает Telegram Web App на весь экран без серых полос
 */
export function initTelegramWebApp(): void {
  if (typeof window === 'undefined') return;
  try {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      if (tg.backgroundColor) {
        tg.backgroundColor = '#141211';
      }
      if (tg.headerColor) {
        tg.headerColor = '#141211';
      }
    }
  } catch {
    // Игнорируем в обычном браузере
  }
}

/**
 * Вызывает тактильный виброотклик Telegram при нажатии кнопок
 */
export function hapticImpact(
  style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium'
): void {
  if (typeof window === 'undefined') return;
  try {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style);
  } catch {
    // Игнорируем вне Telegram
  }
}

/**
 * Вызывает тактильный виброотклик Telegram при завершении действий
 */
export function hapticNotification(
  type: 'success' | 'warning' | 'error' = 'success'
): void {
  if (typeof window === 'undefined') return;
  try {
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred(type);
  } catch {
    // Игнорируем вне Telegram
  }
}
