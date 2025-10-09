'use server';

import jwt from 'jsonwebtoken';

// ========================================================================
// Константы для аутентификации из переменных окружения
// ========================================================================

/** ID сервисного аккаунта Yandex Cloud. */
const SERVICE_ACCOUNT_ID = process.env.YANDEX_SERVICE_ACCOUNT_ID || '';

/** ID авторизованного ключа для сервисного аккаунта. */
const KEY_ID = process.env.YANDEX_API_KEY_ID || '';

/**
 * Приватная часть авторизованного ключа.
 * Заменяем '\n' на реальные переносы строк, так как переменные окружения
 * часто хранят многострочные ключи в одной строке.
 */
const PRIVATE_KEY = (process.env.YANDEX_API_KEY_SECRET || '').replace(/\\n/g, '\n');

// ========================================================================
// Кэш для хранения IAM-токена в памяти
// ========================================================================

/**
 * Переменная для кэширования полученного IAM-токена в памяти.
 * Позволяет избежать повторных запросов к API Yandex Cloud при каждом вызове,
 * так как токены живут до 12 часов (в нашем случае мы запрашиваем на 1 час).
 */
let cachedIAMToken: { token: string; expiresAt: number; } | null = null;


/**
 * Получает IAM-токен для аутентификации в API Yandex Cloud.
 * Функция использует кэширование в памяти, чтобы минимизировать количество запросов.
 * Если валидный токен есть в кэше, он возвращается немедленно.
 * В противном случае, генерируется новый JWT, который обменивается на IAM-токен.
 * @returns {Promise<string>} Промис, который разрешается IAM-токеном.
 * @throws {Error} Если не удалось получить токен из-за ошибки сети или неверных учетных данных.
 */
export async function getIAMToken(): Promise<string> {
  // Проверяем, есть ли токен в кэше и не истечет ли он в ближайшую минуту.
  if (cachedIAMToken && cachedIAMToken.expiresAt > Date.now() + 60 * 1000) {
    return cachedIAMToken.token;
  }

  console.log('[Auth] IAM-токен просрочен или отсутствует. Получаем новый...');

  // --- Этап 1: Создание подписанного JWT ---

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: 'https://iam.api.cloud.yandex.net/iam/v1/tokens', // Адресат токена (API IAM)
    iss: SERVICE_ACCOUNT_ID, // Издатель токена (ID нашего сервисного аккаунта)
    iat: now, // Время создания токена
    exp: now + 3600, // Время истечения токена (1 час)
  };

  // Подписываем JWT нашим приватным ключом
  const signedJwt = jwt.sign(payload, PRIVATE_KEY, {
    algorithm: 'PS256', // Алгоритм подписи, требуемый Yandex Cloud
    keyid: KEY_ID,     // ID ключа, которым мы подписываем
  });


  // --- Этап 2: Обмен JWT на IAM-токен ---

  const response = await fetch('https://iam.api.cloud.yandex.net/iam/v1/tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jwt: signedJwt }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get IAM token: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const iamToken = data.iamToken;

  // --- Этап 3: Кэширование нового токена ---
  cachedIAMToken = {
    token: iamToken,
    expiresAt: now * 1000 + 3600 * 1000, // Сохраняем время истечения в миллисекундах
  };

  console.log('[Auth] Новый IAM-токен успешно получен.');
  return iamToken;
}
