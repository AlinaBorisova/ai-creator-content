import { getIAMToken } from './yandex-auth';

const FOLDER_ID = process.env.YANDEX_FOLDER_ID;
const API_URL = 'https://llm.api.cloud.yandex.net/foundationModels/v1/imageGenerationAsync';

async function generateSingleImage(prompt: string, iamToken: string, folderId: string): Promise<string> {
  // 1. Инициируем генерацию
  const startResponse = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${iamToken}`,
      // Используем `folderId` из аргументов, который гарантированно является строкой
      'x-folder-id': folderId,
    },
    body: JSON.stringify({
      modelUri: `art://${folderId}/yandex-art/latest`,
      messages: [{ weight: 1, text: prompt }],
      generationOptions: {
        seed: Math.floor(Math.random() * 2**32),
      },
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!startResponse.ok) {
    const errorBody = await startResponse.text();
    throw new Error(`[YandexART] Start API Error: ${startResponse.status} ${errorBody}`);
  }

  const startData = await startResponse.json();
  const operationId = startData.id;

  if (!operationId) throw new Error('[YandexART] Could not get operation ID.');

  // Блок ожидания результата (без изменений)
  let isDone = false;
  let finalImageUrl = '';
  const startTime = Date.now();
  const totalTimeout = 180000;

  while (!isDone && (Date.now() - startTime < totalTimeout)) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    const checkResponse = await fetch(`https://operation.api.cloud.yandex.net/operations/${operationId}`, {
      headers: { 'Authorization': `Bearer ${iamToken}` },
      signal: AbortSignal.timeout(120000),
    });
    if (!checkResponse.ok) {
      console.warn(`[YandexART] Check status failed for op ${operationId}: ${checkResponse.status}`);
      continue;
    }
    const checkData = await checkResponse.json();
    if (checkData.done) {
      isDone = true;
      if (checkData.response?.image) {
        finalImageUrl = checkData.response.image;
      } else {
        throw new Error(`[YandexART] Operation finished but no image was returned. Response: ${JSON.stringify(checkData)}`);
      }
    }
  }

  if (!isDone) throw new Error(`[YandexART] Image generation timed out for op ${operationId}.`);

  return `data:image/jpeg;base64,${finalImageUrl}`;
}

// Основная функция
export async function generateImageWithYandexArt(prompt: string): Promise<string[]> {
  // Здесь наша проверка гарантирует, что FOLDER_ID - это строка
  if (!FOLDER_ID) {
    throw new Error('Yandex_FOLDER_ID is not defined in environment variables.');
  }

  console.log(`[YandexART] Запрос на генерацию 4х изображений с промптом: ${prompt}`);

  try {
    const iamToken = await getIAMToken();

    // ✨ 4. ИЗМЕНЕНИЕ: Передаем проверенный FOLDER_ID в каждый вызов
    const promises = [
      generateSingleImage(prompt, iamToken, FOLDER_ID),
      generateSingleImage(prompt, iamToken, FOLDER_ID),
      generateSingleImage(prompt, iamToken, FOLDER_ID),
    ];

    const imageUrls = await Promise.all(promises);
    console.log('[YandexART] 3 изображения успешно сгенерированы.');
    return imageUrls;

  } catch (error) {
    console.error('[YandexART] Global error during parallel generation:', error);
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error('An unknown error occurred during parallel image generation.');
  }
}
