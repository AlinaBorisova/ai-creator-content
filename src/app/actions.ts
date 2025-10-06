"use server";

import { getMessagesFromChannel } from "@/lib/telegram";

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
