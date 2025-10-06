"use server";

import { getMessagesFromChannel } from "@/lib/telegram";
import { getAiAnalysis } from '@/lib/yandex';

// Экспортная функция, которую будем вызывать из формы
export async function fetchChannelMessagesAction(formData: FormData) {
  const channelUsername = formData.get('channelUsername') as string;

  // Простая валидация
  if (!channelUsername || channelUsername.trim() === '') {
    return { messages: [], error: 'Название канала не может быть пустым.' };
  }

  console.log(`[Server Action] Получен запрос для канала: ${channelUsername}`);

  try {
    // Мы вызываем функцию из lib
    const messages = await getMessagesFromChannel(channelUsername);
    return { messages, error: null };
  } catch (error) {
    console.error('[Server Action] Ошибка при получении сообщений:', error);
    return { messages: [], error: 'Произошла ошибка на сервере. Возможно, неверное имя канала или проблема с API.' };
  }
}

export async function analyzePostAction(postText: string) {
  'use server';
  try {
    const analysis = await getAiAnalysis(postText);
    return { analysis };
  } catch (error) {
    // Приводим ошибку к стандартному виду для передачи на клиент
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: 'Произошла неизвестная ошибка при анализе' };
  }
}

