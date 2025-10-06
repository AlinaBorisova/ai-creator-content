// src/lib/kandinsky.ts

import { v4 as uuidv4 } from 'uuid';

if (!process.env.SBER_CLIENT_SECRET) {
  throw new Error('Sber GigaChat API client secret is not configured in .env.local');
}

const CLIENT_SECRET = process.env.SBER_CLIENT_SECRET;

// --- Вспомогательная функция для fetch с таймаутом ---
async function fetchWithTimeout(url: string, options: RequestInit, timeout = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    // Перехватываем ошибку AbortError и превращаем ее в понятный TIMEOUT
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout / 1000} seconds.`);
    }
    throw error;
  }
}

// --- Часть 1: Авторизация (без изменений, но будет использовать новую функцию fetch) ---
let tokenCache = {
  accessToken: '',
  expiresAt: 0,
};

async function getSberAuthToken(): Promise<string> {
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  console.log('[Kandinsky] Токен устарел или отсутствует, получаем новый...');
  const response = await fetchWithTimeout('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'RqUID': uuidv4(),
      'Authorization': `Basic ${CLIENT_SECRET}`,
    },
    body: 'scope=GIGACHAT_API_PERS',
  }, 10000); // Таймаут 10 секунд для авторизации

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Sber auth failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  tokenCache.accessToken = data.access_token;
  tokenCache.expiresAt = Date.now() + (data.expires_at - 60000);
  console.log('[Kandinsky] Новый токен успешно получен.');

  return tokenCache.accessToken;
}

// --- Часть 2: Генерация изображения (также использует fetch с таймаутом) ---
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function generateImageWithKandinsky(prompt: string): Promise<string> {
  const token = await getSberAuthToken();

  console.log('[Kandinsky] Запускаем генерацию изображения...');
  const runResponse = await fetchWithTimeout('https://gigachat.devices.sberbank.ru/api/v1/kandinsky/text2image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: "KANDINSKY_3_1",
      prompt: prompt,
      width: 1024,
      height: 1024,
    }),
  }, 30000); // Таймаут 30 секунд на запуск генерации

  if (!runResponse.ok) {
    const errorText = await runResponse.text();
    throw new Error(`Failed to start image generation. Server response: ${errorText}`);
  }
  const runData = await runResponse.json();
  const taskId = runData.id;

  console.log(`[Kandinsky] Задача создана с ID: ${taskId}. Ожидаем завершения...`);
  for (let i = 0; i < 20; i++) { // Проверяем 20 раз с задержкой (общий таймаут ~2 минуты)
    await delay(6000);

    const statusResponse = await fetchWithTimeout(`https://gigachat.devices.sberbank.ru/api/v1/kandinsky/generations/${taskId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    }, 10000); // Таймаут 10 секунд на проверку статуса

    if (!statusResponse.ok) continue;

    const statusData = await statusResponse.json();
    if (statusData.status === 'DONE') {
      console.log('[Kandinsky] Генерация успешно завершена!');
      return statusData.result.images[0];
    }
    if (statusData.status === 'FAILED') {
      throw new Error(`Image generation failed: ${statusData.result.error}`);
    }
    console.log(`[Kandinsky] Статус задачи: ${statusData.status}... (${i+1}/20)`);
  }

  throw new Error('Image generation timed out after polling for 2 minutes.');
}
