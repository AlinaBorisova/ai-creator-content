// In-memory rate limiter с возможностью расширения до Redis
interface RateLimitEntry {
  count: number;
  resetAt: number; // Timestamp когда счетчик сбросится
}

// Кэш для хранения счетчиков запросов
const rateLimitCache = new Map<string, RateLimitEntry>();

// Конфигурация лимитов для разных типов endpoints
export interface RateLimitConfig {
  maxRequests: number; // Максимальное количество запросов
  windowMs: number; // Окно времени в миллисекундах
}

// Предустановленные конфигурации для разных типов endpoints
export const RATE_LIMIT_CONFIGS = {
  // AI генерация - более строгие лимиты
  AI_GENERATION: {
    maxRequests: 10, // 10 запросов
    windowMs: 60 * 1000, // в минуту
  },
  AI_IMAGE: {
    maxRequests: 50, // 5 запросов
    windowMs: 60 * 1000, // в минуту
  },
  AI_VIDEO: {
    maxRequests: 3, // 3 запроса
    windowMs: 60 * 1000, // в минуту
  },
  AI_RESEARCH: {
    maxRequests: 5, // 5 запросовЫ
    windowMs: 60 * 1000, // в минуту
  },
  AI_SEO_ARTICLE: {
    maxRequests: 3, // 3 запроса (SEO статьи требуют много ресурсов)
    windowMs: 60 * 1000, // в минуту
  },
  // История - более мягкие лимиты
  HISTORY: {
    maxRequests: 30, // 30 запросов
    windowMs: 60 * 1000, // в минуту
  },
  // Проверка статуса и скачивание - более мягкие лимиты
  AI_STATUS: {
    maxRequests: 60, // 60 запросов (частое polling)
    windowMs: 60 * 1000, // в минуту
  },
  // Аутентификация - средние лимиты
  AUTH: {
    maxRequests: 20, // 20 запросов
    windowMs: 60 * 1000, // в минуту
  },
  // Общий лимит по умолчанию
  DEFAULT: {
    maxRequests: 30, // 30 запросов
    windowMs: 60 * 1000, // в минуту
  },
} as const;

/**
 * Очистка устаревших записей из кэша
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitCache.entries()) {
    if (now > entry.resetAt) {
      rateLimitCache.delete(key);
    }
  }
}

// Периодическая очистка каждые 5 минут
// Проверяем, что мы в Node.js окружении (не Edge Runtime)
if (typeof process !== 'undefined' && process.env && typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredEntries, 5 * 60 * 1000);
}

/**
 * Проверяет, не превышен ли лимит запросов
 * @param identifier - Уникальный идентификатор (userId, IP, token и т.д.)
 * @param config - Конфигурация лимита
 * @returns Результат проверки лимита
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const key = `${identifier}:${config.windowMs}`;
  
  const entry = rateLimitCache.get(key);

  // Если записи нет или она истекла, создаем новую
  if (!entry || now > entry.resetAt) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    rateLimitCache.set(key, newEntry);
    
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: newEntry.resetAt,
    };
  }

  // Если лимит превышен
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  // Увеличиваем счетчик
  entry.count++;
  rateLimitCache.set(key, entry);

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Получить информацию о текущем лимите без увеличения счетчика
 * @param identifier - Уникальный идентификатор
 * @param config - Конфигурация лимита
 * @returns Информация о лимите
 */
export function getRateLimitInfo(
  identifier: string,
  config: RateLimitConfig
): { remaining: number; resetAt: number } {
  const now = Date.now();
  const key = `${identifier}:${config.windowMs}`;
  
  const entry = rateLimitCache.get(key);

  if (!entry || now > entry.resetAt) {
    return {
      remaining: config.maxRequests,
      resetAt: now + config.windowMs,
    };
  }

  return {
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetAt: entry.resetAt,
  };
}

/**
 * Сбросить счетчик для идентификатора
 * @param identifier - Уникальный идентификатор
 */
export function resetRateLimit(identifier: string): void {
  for (const key of rateLimitCache.keys()) {
    if (key.startsWith(`${identifier}:`)) {
      rateLimitCache.delete(key);
    }
  }
}

