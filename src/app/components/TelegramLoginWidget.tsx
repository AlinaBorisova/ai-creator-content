// src/app/components/TelegramLoginWidget.tsx (ИСПРАВЛЕННАЯ ВЕРСЯ)
'use client';

import { signIn } from 'next-auth/react';
import { useEffect, useRef } from 'react'; // <-- ИЗМЕНЕНИЕ: Добавили useRef

// Тип для данных, которые возвращает Telegram (без изменений)
interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

// РАСШИРЯЕМ ГЛОБАЛЬНЫЙ ТИП WINDOW (без изменений)
declare global {
  interface Window {
    onTelegramAuth: (user: TelegramUser) => void;
  }
}

export default function TelegramLoginWidget() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log('useEffect running. Setting up window.onTelegramAuth...');

    window.onTelegramAuth = (user: TelegramUser) => {
      console.log('SUCCESS! onTelegramAuth was called by Telegram. User data:', user);
      signIn('telegram-widget', {
        ...user,
        redirect: false,
      })
        .then((result) => {
          console.log('NextAuth signIn result:', result);
          if (result && !result.error) {
            console.log('Login successful, redirecting to /');
            window.location.href = '/';
          } else {
            console.error('NextAuth signIn failed:', result?.error);
          }
        })
        .catch((error) => {
          console.error('An unexpected error occurred during signIn:', error);
        });
    };

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || '');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');

    // Вставляем созданный скрипт в наш div-"якорь"
    ref.current?.appendChild(script);

  }, []);

  return <div ref={ref} />;
}

