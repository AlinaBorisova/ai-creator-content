// src/lib/cometapi.ts

if (!process.env.COMETAPI_KEY) {
  throw new Error('CometAPI key is not configured in .env.local');
}

const API_KEY = process.env.COMETAPI_KEY;
const API_URL = 'https://api.cometapi.com/v1/image/generations';

export async function generateImageWithCometAPI(prompt: string): Promise<string> {
  console.log('[CometAPI] Запускаем генерацию изображения...');

  // ⚠️ ВАЖНО: Найдите правильный ID модели в документации или дашборде CometAPI
  // Это может быть 'google/imagen-3', 'sdxl-1.0' или что-то другое.
  const modelId = 'google/imagen-3';

  const requestBody = {
    prompt: prompt,
    model_id: modelId,
    num_outputs: 1,
    height: 1024,
    width: 1024,
    // Этот параметр очень важен! Мы просим API вернуть картинку сразу, а не ссылку.
    response_format: 'b64_json',
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      // Если сервер вернул ошибку, пытаемся прочитать ее и показать
      const errorData = await response.json();
      console.error('[CometAPI] Server Error:', errorData);
      const errorMessage = errorData.detail || `API request failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    const responseData = await response.json();

    // Структура ответа может отличаться. Проверяем самые частые варианты.
    // Обычно это массив 'outputs' и в нем объект с полем 'image'.
    const base64Image = responseData.outputs?.[0]?.image;

    if (!base64Image) {
      console.error('[CometAPI] Неожиданная структура ответа:', responseData);
      throw new Error('API did not return a base64 image in the expected format.');
    }

    console.log('[CometAPI] Генерация успешно завершена!');
    return base64Image;

  } catch (error) {
    console.error('[CometAPI] Ошибка при генерации:', error);
    // Перебрасываем ошибку дальше, чтобы она отобразилась на фронтенде
    throw error;
  }
}
