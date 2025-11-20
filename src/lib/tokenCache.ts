// Простое кэширование токенов в памяти для снижения нагрузки на БД
interface CachedToken {
  valid: boolean;
  user?: {
    id: string;
    name: string;
    email?: string;
  };
  expiresAt: number; // Время истечения кэша (не токена!)
}

const tokenCache = new Map<string, CachedToken>();

// ОПТИМИЗАЦИЯ: увеличиваем TTL кэша до 30 минут для снижения нагрузки на БД
const CACHE_TTL = 30 * 60 * 1000; // 30 минут вместо 5

// Максимальный размер кэша
const MAX_CACHE_SIZE = 1000;

/**
 * Получить токен из кэша
 */
export function getCachedToken(token: string): CachedToken | null {
  const cached = tokenCache.get(token);
  if (!cached) return null;

  // Проверяем, не истек ли кэш
  if (Date.now() > cached.expiresAt) {
    tokenCache.delete(token);
    return null;
  }

  return cached;
}

/**
 * Сохранить токен в кэш
 */
export function setCachedToken(
  token: string,
  valid: boolean,
  user?: { id: string; name: string; email?: string }
): void {
  tokenCache.set(token, {
    valid,
    user,
    expiresAt: Date.now() + CACHE_TTL,
  });

  // Очистка старых записей, если кэш переполнен
  if (tokenCache.size > MAX_CACHE_SIZE) {
    // Удаляем самые старые записи
    const entries = Array.from(tokenCache.entries());
    entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);

    // Удаляем 10% самых старых записей
    const toDelete = Math.floor(MAX_CACHE_SIZE * 0.1);
    for (let i = 0; i < toDelete && i < entries.length; i++) {
      tokenCache.delete(entries[i][0]);
    }
  }
}

/**
 * Удалить токен из кэша (например, при деактивации)
 */
export function invalidateToken(token: string): void {
  tokenCache.delete(token);
}

/**
 * Очистить весь кэш
 */
export function clearCache(): void {
  tokenCache.clear();
}

