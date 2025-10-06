'use server';

import { getIAMToken } from './yandex-auth'; // <-- ИМПОРТИРУЕМ

// YANDEX_API_KEY больше не нужен
const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID || '';

export async function rewriteTextWithYandexGPT(originalText: string): Promise<string> {

  const systemPrompt = `Ты — AI-ассистент для редактирования постов в Telegram. Твоя задача состоит из двух шагов: 1. Сделай качественный и уникальный рерайт предоставленного текста. 2. После рерайта придумай и добавь яркий, детальный промпт на английском языке для AI-генератора изображений, который отражает суть текста. ПРАВИЛА: Промпт ОБЯЗАТЕЛЬНО должен быть заключен в теги <prompt> и </prompt>. Если промпт придумать невозможно, напиши внутри тегов "no prompt". ПРИМЕР: "Текст поста... <prompt>A detailed prompt in English</prompt>".`;

  const iamToken = await getIAMToken(); // <-- ПОЛУЧАЕМ ТОКЕН

  const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${iamToken}`, // <-- ИСПОЛЬЗУЕМ ТОКЕН
      'x-folder-id': YANDEX_FOLDER_ID,
    },
    body: JSON.stringify({
      "modelUri": `gpt://${YANDEX_FOLDER_ID}/yandexgpt/latest`,
      "completionOptions": { "stream": false, "temperature": 0.6, "maxTokens": "2000" },
      "messages": [
        { "role": "system", "text": systemPrompt },
        { "role": "user", "text": originalText }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`YandexGPT request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.result.alternatives[0].message.text;
}
