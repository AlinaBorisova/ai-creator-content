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
// Это "правильный" способ сообщить TypeScript, что у объекта window
// теперь есть наше кастомное свойство onTelegramAuth.
declare global {
  interface Window {
    onTelegramAuth: (user: TelegramUser) => void;
  }
}

export default function TelegramLoginWidget() {
  // Этот эффект гарантирует, что наша функция-обработчик будет доступна глобально,
  // когда скрипт Telegram ее вызовет.
  useEffect(() => {
    // Теперь мы можем обращаться к window.onTelegramAuth напрямую, без "(as any)"
    window.onTelegramAuth = (user: TelegramUser) => {
      // Когда пользователь авторизовался, мы вызываем signIn с нашими данными
      signIn('telegram-widget', {
        ...user,
        redirect: false, // Отключаем автоматический редирект от NextAuth
      }).then((result) => {
        // После успешного входа вручную перезагружаем страницу, чтобы обновить сессию
        if (result && !result.error) {
          window.location.href = '/';
        }
      });
    };
  }, []);

  return (
    // Это единственный скрипт, который нам нужен. Он сам найдет этот div
    // и вставит в него кнопку.
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
