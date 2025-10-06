'use server';

import { getIAMToken } from './yandex-auth';

const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID || '';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function generateImageWithYandexArt(prompt: string): Promise<string> {
  console.log('[YandexART] Запрос на генерацию изображения с промптом:', prompt);

  const iamToken = await getIAMToken();

  const initialResponse = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/imageGenerationAsync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${iamToken}`,
      'x-folder-id': YANDEX_FOLDER_ID,
    },
    body: JSON.stringify({
      // ============== ВОТ ЗДЕСЬ ИСПРАВЛЕНИЕ ==============
      "modelUri": `art://${YANDEX_FOLDER_ID}/yandex-art/latest`,
      // ====================================================
      "messages": [{ "weight": 1, "text": prompt }],
      "generationOptions": { "seed": Math.floor(Math.random() * 1000000) }
    })
  });

  if (!initialResponse.ok) {
    const errorText = await initialResponse.text();
    throw new Error(`[YandexART] Initial request failed: ${initialResponse.status} ${errorText}`);
  }

  const initialData = await initialResponse.json();
  const operationId = initialData.id;

  for (let i = 0; i < 20; i++) {
    await sleep(3000);
    const pollToken = await getIAMToken();
    const statusResponse = await fetch(`https://operation.api.cloud.yandex.net/operations/${operationId}`, {
      headers: { 'Authorization': `Bearer ${pollToken}` }
    });

    if (!statusResponse.ok) continue;

    const statusData = await statusResponse.json();
    if (statusData.done) {
      if (statusData.response?.image) {
        return `data:image/jpeg;base64,${statusData.response.image}`;
      } else {
        throw new Error(`[YandexART] Operation finished but no image. Response: ${JSON.stringify(statusData)}`);
      }
    }
  }

  throw new Error('[YandexART] Image generation timed out.');
}
