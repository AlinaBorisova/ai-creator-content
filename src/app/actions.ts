'use server';

import { getMessages } from '@/lib/telegram';
import { rewriteTextWithYandexGPT } from '@/lib/yandex-text';
import { generateImageWithYandexArt } from '@/lib/yandex-image';
import { extractPrompt, cleanTextForAI } from '@/lib/utils';

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
  } catch (error: any) {
    return { error: error.message || 'Failed to fetch messages.' };
  }
}

export async function rewriteTextAction(text: string) {
  try {
    // 1. Сначала очищаем текст от мусора
    const cleanedTextForAI = cleanTextForAI(text);

    // 2. Отправляем в YandexGPT уже очищенный текст
    const fullText = await rewriteTextWithYandexGPT(cleanedTextForAI);

    const prompt = extractPrompt(fullText);
    const cleanText = fullText.replace(/<prompt>.*?<\/prompt>/s, '').trim();
    return { data: { cleanText, prompt } };
  } catch (error: any) {
    return { error: error.message || 'Failed to rewrite text.' };
  }
}

export async function generateImageAction(prompt: string) {
  try {
    if (!prompt || prompt === 'no prompt') {
      return { error: 'Prompt is empty or invalid. Cannot generate image.' };
    }
    const imageUrl = await generateImageWithYandexArt(prompt);
    return { data: imageUrl };
  } catch (error: any) {
    return { error: error.message || 'Failed to generate image.' };
  }
}
