'use client';

import { useSession, signOut } from "next-auth/react";
import TelegramLoginWidget from "@/app/components/TelegramLoginWidget";
import { MessageFetcher } from "@/app/components/MessageFetcher";

export default function HomePage() {
  // Получаем данные о текущей сессии и статус загрузки
  const { data: session, status } = useSession();

  // --- Состояние 1: Загрузка ---
  // Пока NextAuth проверяет наличие сессии, показываем индикатор загрузки
  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
        <p>Проверка авторизации...</p>
      </main>
    );
  }

  // --- Состояние 2: Пользователь авторизован ---
  // Если объект session существует, значит, пользователь вошел
  if (session) {
    return (
      <main className="min-h-screen bg-gray-900 text-white p-4 sm:p-8">
        <div className="max-w-3xl mx-auto">
          {/* Мы немного изменяем header, чтобы добавить приветствие и кнопку выхода */}
          <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold">TG Parser</h1>
              <p className="text-gray-400 mt-2">
                Добро пожаловать, {session.user?.name}!
              </p>
            </div>
            <button
              onClick={() => signOut()} // Функция выхода из next-auth
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
            >
              Выйти
            </button>
          </header>

          <MessageFetcher />

        </div>
      </main>
    );
  }

  // --- Состояние 3: Пользователь не авторизован ---
  // Если сессии нет, показываем экран входа
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white p-4">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl text-center max-w-md w-full">
        <h1 className="text-3xl font-bold mb-2">TG Parser</h1>
        <p className="text-gray-400 mb-8">
          Войдите через Telegram для анализа постов
        </p>
        <div className="flex justify-center">
          <TelegramLoginWidget />
        </div>
      </div>
    </main>
  );
}
