'use server';

import { revalidatePath } from 'next/cache';
import { getMessages, sendPostToChannel } from '@/lib/telegram';
import { generateImageWithImagen4 } from '@/lib/imagen';
import { extractPrompt, cleanTextForAI } from '@/lib/utils';
import { rewriteTextWithYandexGPT, generatePromptFromText } from '@/lib/yandex-text';

/**
 * Получает сообщения из указанного Telegram-канала, сортирует их по количеству реакций
 * и очищает текст от ненужных символов для дальнейшей обработки.
 * @param channelId - ID Telegram-канала, из которого нужно получить сообщения.
 * @returns Объект, содержащий либо массив отсортированных и очищенных сообщений в поле `data`, либо ошибку в поле `error`.
 */
export async function getTelegramMessagesAction(channelId: string) {
  try {
    // 1. Получаем посты с реакциями
    const messagesWithReactions = await getMessages(channelId);

    // 2. Сортируем массив по убыванию количества реакций
    messagesWithReactions.sort((a, b) => b.reactions - a.reactions);

    // 3. Применяем очистку к тексту каждого поста уже после сортировки
    const cleanedAndSortedMessages = messagesWithReactions.map(post => ({
      ...post,
      text: cleanTextForAI(post.text),
    }));

    // 4. Возвращаем отсортированные и очищенные данные
    return { data: cleanedAndSortedMessages };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'An unknown error occurred' };
  }
}

/**
 * Принимает исходный текст, делает его рерайт с помощью YandexGPT и извлекает из результата
 * сам переписанный текст и сгенерированный промпт для изображения.
 * @param text - Исходный текст для рерайта.
 * @returns Объект, содержащий `data` с полями `cleanText` (рерайт) и `prompt` (промпт), либо ошибку в поле `error`.
 */
export async function rewriteTextAction(text: string) {
  try {
    // 1. Сначала очищаем текст от мусора
    const cleanedTextForAI = cleanTextForAI(text);

    // 2. Отправляем в YandexGPT уже очищенный текст
    const fullText = await rewriteTextWithYandexGPT(cleanedTextForAI);

    // Извлекаем промпт из ответа нейросети
    const prompt = extractPrompt(fullText);
    // Очищаем текст рерайта от тегов промпта
    const cleanText = fullText.replace(/<prompt>.*?<\/prompt>/s, '').trim();
    return { data: { cleanText, prompt } };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Failed to rewrite text.' };
  }
}

/**
 * Генерирует изображения на основе предоставленного текстового промпта.
 * @param prompt - Текстовый промпт на английском языке для модели генерации изображений.
 * @returns Объект, содержащий массив URL-адресов сгенерированных изображений в поле `data`, либо ошибку в поле `error`.
 */
export async function generateImageAction(prompt: string) {
  try {
    // Проверяем, что промпт не пустой и валидный
    if (!prompt || prompt === 'no prompt') {
      return { error: 'Prompt is empty or invalid. Cannot generate image.' };
    }
    const imageUrls = await generateImageWithImagen4(prompt);
    // Сбрасываем кэш для главной страницы, если это необходимо
    revalidatePath('/');
    return { data: imageUrls };
  } catch (error: unknown) {
    console.error('[Action Error]', error);
    return { error: error instanceof Error ? error.message : 'An unknown error occurred' };
  }
}

/**
 * Отправляет готовый пост (текст и изображение) в указанный Telegram-канал.
 * @param channelId - ID целевого Telegram-канала для публикации.
 * @param text - Финальный текст поста.
 * @param imageBase64 - Выбранное изображение, закодированное в формат Base64.
 * @returns Объект, содержащий `success: true` в случае удачной отправки, либо ошибку в поле `error`.
 */
export async function sendPostAction(channelId: string, text: string, imageBase64: string) {
  try {
    // Вызываем функцию для отправки сообщения через Telegram API
    await sendPostToChannel(channelId, text, imageBase64);
    // Возвращаем успешный результат
    return { success: true };
  } catch (error: unknown) {
    console.error('[Action Error] Failed to send post:', error);
    // Возвращаем ошибку, чтобы показать ее в интерфейсе
    return { error: error instanceof Error ? error.message : 'An unknown error occurred while sending the post.' };
  }
}

/**
 * Повторно генерирует промпт для изображения на основе измененного пользователем текста.
 * Используется, когда пользователь отредактировал рерайт и хочет обновить промпт.
 * @param text - Отредактированный текст рерайта.
 * @returns Объект, содержащий новый промпт в поле `data`, либо ошибку в поле `error`.
 */
export async function regeneratePromptAction(text: string) {
  try {
    const newPrompt = await generatePromptFromText(text);
    return { data: newPrompt };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Failed to regenerate prompt.' };
  }
}
