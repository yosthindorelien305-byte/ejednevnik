'use client';

import { useEffect } from 'react';
import { initTelegramWebApp } from '@/lib/telegram/webapp';

export function TelegramInit() {
  useEffect(() => {
    initTelegramWebApp();

    // Немедленное удаление любых внедренных Netlify Drawer, бейджей и виджетов
    const purgeNetlifyElements = () => {
      const selectors = [
        'netlify-drawer',
        '[data-netlify-drawer]',
        '#netlify-drawer',
        'iframe[src*="netlify"]',
        'iframe[id*="netlify"]',
        '.netlify-badge',
        'a[href*="netlify.com"]',
        '[data-netlify-feedback]',
        '#netlify-notification',
      ];
      selectors.forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => {
          el.remove();
        });
      });
    };

    purgeNetlifyElements();

    const observer = new MutationObserver(() => {
      purgeNetlifyElements();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return null;
}
