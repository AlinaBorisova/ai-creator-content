// src/app/components/TelegramLoginWidget.tsx
'use client';

import { signIn } from 'next-auth/react';
import Script from 'next/script';
import { useEffect } from 'react';

// Тип для данных, которые возвращает Telegram
interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

// РАСШИРЯЕМ ГЛОБАЛЬНЫЙ ТИП WINDOW
declare global {
  interface Window {
    onTelegramAuth: (user: TelegramUser) => void;
  }
}

export default function TelegramLoginWidget() {
  // МАЯЧОК №1: Проверяем, что переменная окружения доступна на клиенте.
  // Если здесь будет 'undefined', то виджет не будет работать.
  console.log(
    'Widget is rendering. Bot name from env:',
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME
  );

  useEffect(() => {
    // МАЯЧОК №2: Убеждаемся, что наш хук запускается и функция назначается.
    console.log('useEffect running. Setting up window.onTelegramAuth...');

    window.onTelegramAuth = (user: TelegramUser) => {
      // МАЯЧОК №3: САМЫЙ ВАЖНЫЙ. Если мы видим это сообщение, значит Telegram
      // успешно авторизовал пользователя и вызвал нашу функцию.
      console.log('SUCCESS! onTelegramAuth was called by Telegram. User data:', user);

      // Когда пользователь авторизовался, мы вызываем signIn с нашими данными
      signIn('telegram-widget', {
        ...user,
        redirect: false, // Отключаем автоматический редирект от NextAuth
      })
        .then((result) => {
          // МАЯЧОК №4: Смотрим, что ответил NextAuth после попытки входа.
          console.log('NextAuth signIn result:', result);

          // После успешного входа вручную перезагружаем страницу, чтобы обновить сессию
          if (result && !result.error) {
            console.log('Login successful, redirecting to /');
            window.location.href = '/';
          } else {
            // Если есть ошибка от NextAuth, выводим ее.
            console.error('NextAuth signIn failed:', result?.error);
          }
        })
        .catch((error) => {
          // МАЯЧОК №5: Ловим любые непредвиденные ошибки в процессе signIn.
          console.error('An unexpected error occurred during signIn:', error);
        });
    };
  }, []);

  return (
    <div id="telegram-login-container">
      <Script
        async
        src="https://telegram.org/js/telegram-widget.js?22"
        data-telegram-login={process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME}
        data-size="large"
        data-onauth="onTelegramAuth(user)"
        data-request-access="write"
      />
    </div>
  );
}
