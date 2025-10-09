'use client';

import { signIn } from 'next-auth/react';
import { useEffect, useRef } from 'react';

/**
 * Определяет структуру данных пользователя, которую возвращает виджет Telegram
 * после успешной аутентификации.
 */
interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/**
 * Расширяет глобальный тип `Window` в TypeScript.
 * Это необходимо, чтобы объявить функцию `onTelegramAuth` в глобальной области видимости,
 * к которой сможет обратиться внешний скрипт Telegram.
 */
declare global {
  interface Window {
    onTelegramAuth: (user: TelegramUser) => void;
  }
}

/**
 * Компонент, который рендерит кнопку входа через Telegram.
 * Он динамически загружает и настраивает скрипт виджета от Telegram.
 */
export default function TelegramLoginWidget() {
  // useRef для получения прямой ссылки на DOM-элемент (div),
  // который будет служить "якорем" для вставки скрипта Telegram.
  const ref = useRef<HTMLDivElement>(null);

  /**
   * useEffect, который выполняется один раз после монтирования компонента.
   * Его задача — настроить всё необходимое для работы виджета.
   */
  useEffect(() => {
    console.log('useEffect running. Setting up window.onTelegramAuth...');

    /**
     * Глобальная callback-функция, которая будет вызвана скриптом Telegram
     * после того, как пользователь успешно войдет в систему.
     * @param user - Объект с данными пользователя от Telegram.
     */
    window.onTelegramAuth = (user: TelegramUser) => {
      console.log('SUCCESS! onTelegramAuth was called by Telegram. User data:', user);

      // Вызываем функцию signIn из NextAuth с ID нашего провайдера ('telegram-widget').
      // Передаем все данные пользователя в качестве credentials.
      // `redirect: false` отключает автоматическую перезагрузку страницы,
      // позволяя нам обработать результат вручную.
      signIn('telegram-widget', {
        ...user,
        redirect: false,
      })
        .then((result) => {
          console.log('NextAuth signIn result:', result);
          // Если вход прошел успешно (на бэкенде отработала функция authorize),
          // вручную перенаправляем пользователя на главную страницу.
          if (result && !result.error) {
            console.log('Login successful, redirecting to /');
            window.location.href = '/';
          } else {
            // В случае ошибки на стороне NextAuth, выводим её в консоль.
            console.error('NextAuth signIn failed:', result?.error);
          }
        })
        .catch((error) => {
          console.error('An unexpected error occurred during signIn:', error);
        });
    };

    // Динамически создаем элемент <script> для виджета Telegram.
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;

    // Устанавливаем data-атрибуты для конфигурации виджета.
    script.setAttribute('data-telegram-login', process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || '');
    script.setAttribute('data-size', 'large');
    // Самый важный атрибут: указываем, какую глобальную функцию вызвать после аутентификации.
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');

    // Вставляем созданный скрипт в наш div-"якорь".
    // Браузер загрузит и выполнит этот скрипт, отобразив кнопку входа.
    ref.current?.appendChild(script);

  }, []); // Пустой массив зависимостей гарантирует, что эффект выполнится только один раз.

  // Компонент рендерит пустой div, который используется как контейнер для виджета.
  return <div ref={ref} />;
}