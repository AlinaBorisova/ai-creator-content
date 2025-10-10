// Константы для взаимодействия с API gen-api.ru
// const API_KEY = process.env.IMAGEN_API_KEY;
// const START_GENERATION_URL = 'https://api.gen-api.ru/api/v1/networks/imagen-4';
// const CHECK_STATUS_URL_BASE = 'https://api.gen-api.ru/api/v1/request/get/';

const API_KEY = process.env.FLUX_API_KEY;
const START_GENERATION_URL = 'https://api.gen-api.ru/api/v1/networks/flux';
const CHECK_STATUS_URL_BASE = 'https://api.gen-api.ru/api/v1/request/get/';

/**
 * Вспомогательная функция, отвечающая за асинхронную генерацию ОДНОГО изображения.
 * Процесс состоит из двух этапов:
 * 1. Отправка запроса на запуск генерации и получение ID задачи (request_id).
 * 2. Периодическая проверка статуса задачи по ее ID до получения успешного результата или истечения таймаута.
 * @param prompt - Текстовый промпт для генерации изображения.
 * @returns Промис, который разрешается URL-адресом сгенерированного изображения.
 * @throws Ошибка, если не удалось запустить генерацию, получить ID, или если генерация превысила таймаут.
 */
async function generateSingleImage(prompt: string): Promise<string> {
  // Этап 1: Запуск задачи на генерацию
  const startResponse = await fetch(START_GENERATION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
    body: JSON.stringify({ prompt, "model": "schnell", images: 1, width: 1024, height: 1024 }),
    signal: AbortSignal.timeout(60000), // Таймаут на сам запрос, если API долго не отвечает
  });

  if (!startResponse.ok) {
    throw new Error(`[Imagen 4] Start API Error: ${await startResponse.text()}`);
  }

  const startData = await startResponse.json();
  const requestId = startData?.request_id;
  if (!requestId) throw new Error(`Could not get request_id: ${JSON.stringify(startData)}`);

  // Этап 2: Ожидание результата с периодической проверкой (polling)
  const startTime = Date.now();
  while (Date.now() - startTime < 180000) { // Общий таймаут на всю генерацию - 3 минуты
    await new Promise(resolve => setTimeout(resolve, 5000)); // Пауза 5 секунд между проверками
    const checkResponse = await fetch(`${CHECK_STATUS_URL_BASE}${requestId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${API_KEY}` },
    });
    if (!checkResponse.ok) continue; // Если проверка не удалась, пробуем снова в следующей итерации

    const checkData = await checkResponse.json();
    if (checkData.status === 'success') {
      // API возвращает массив даже для одного изображения, берем первый элемент
      if (checkData.result && checkData.result.length > 0) {
        return checkData.result[0]; // Успех! Возвращаем URL изображения.
      }
      throw new Error(`Operation finished but no image was returned.`);
    }
  }
  // Если цикл завершился, значит, таймаут истек
  throw new Error(`Image generation timed out for request ${requestId}.`);
}

/**
 * Основная экспортируемая функция. Запускает генерацию 3-х изображений параллельно
 * на основе одного и того же промпта, используя вспомогательную функцию `generateSingleImage`.
 * @param prompt - Текстовый промпт для генерации изображений.
 * @returns Промис, который разрешается массивом из трех URL-адресов сгенерированных изображений.
 * @throws Ошибка, если ключ API не определен или если произошла ошибка в процессе генерации.
 */
export async function generateImageWithImagen4(prompt: string): Promise<string[]> {
  if (!API_KEY) {
    throw new Error('IMAGEN_API_KEY is not defined in environment variables.');
  }

  try {
    console.log(`[Imagen 4] Запрос на генерацию 3х изображений параллельно...`);

    // Создаем массив из трех промисов, каждый из которых генерирует одно изображение
    const promises = [
      generateSingleImage(prompt),
      generateSingleImage(prompt),
      generateSingleImage(prompt),
    ];

    // Ожидаем выполнения всех трех промисов параллельно с помощью Promise.all
    const imageUrls = await Promise.all(promises);

    console.log('[Imagen 4] 3 изображения успешно сгенерированы.');
    return imageUrls;

  } catch (error) {
    console.error('[Imagen 4] Global error during parallel generation:', error);
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error('An unknown error occurred during image generation.');
  }
}
