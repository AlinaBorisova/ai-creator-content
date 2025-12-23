import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RateLimitConfig, RATE_LIMIT_CONFIGS } from './rateLimiter';
import { verifyToken } from '@/lib/auth/tokenVerification';

/**
 * Получает идентификатор для rate limiting
 * Приоритет: userId из токена > IP адрес
 * Оптимизация: сначала проверяем IP для быстрой идентификации
 */
async function getRateLimitIdentifier(
  request: NextRequest
): Promise<string> {
  // Получаем IP адрес (быстрая проверка)
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 
    request.headers.get('x-real-ip') || 
    'unknown';

  // Пытаемся получить токен
  const token = request.cookies.get('authToken')?.value ||
    request.headers.get('authorization')?.replace('Bearer ', '');

  // Если есть токен, проверяем его и используем userId (более точная идентификация)
  if (token) {
    try {
      // Используем кэш для быстрой проверки
      const verification = await verifyToken(token, true);
      if (verification.valid && verification.user) {
        return `user:${verification.user.id}`;
      }
    } catch {
      // Если проверка токена не удалась, используем IP
    }
  }

  // Используем IP адрес как fallback
  return `ip:${ip}`;
}

/**
 * Создает middleware для rate limiting
 * @param config - Конфигурация лимита
 * @returns Middleware функция
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    try {
      const identifier = await getRateLimitIdentifier(request);
      const result = checkRateLimit(identifier, config);

      if (!result.allowed) {
        const resetDate = new Date(result.resetAt);
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            message: `Too many requests. Please try again after ${resetDate.toISOString()}`,
            retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000), // секунды
          },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': config.maxRequests.toString(),
              'X-RateLimit-Remaining': result.remaining.toString(),
              'X-RateLimit-Reset': result.resetAt.toString(),
              'Retry-After': Math.ceil((result.resetAt - Date.now()) / 1000).toString(),
            },
          }
        );
      }

      // Добавляем заголовки с информацией о лимите
      const response = NextResponse.next();
      response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
      response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
      response.headers.set('X-RateLimit-Reset', result.resetAt.toString());

      return response;
    } catch (error) {
      console.error('Rate limit middleware error:', error);
      // В случае ошибки пропускаем запрос (fail-open)
      return NextResponse.next();
    }
  };
}

/**
 * Helper для применения rate limiting в API routes
 * @param request - NextRequest объект
 * @param config - Конфигурация лимита (или ключ из RATE_LIMIT_CONFIGS)
 * @returns NextResponse с ошибкой или null если лимит не превышен
 */
export async function applyRateLimit(
  request: NextRequest,
  config: RateLimitConfig | keyof typeof RATE_LIMIT_CONFIGS
): Promise<NextResponse | null> {
  // Отключаем rate limiting в development, если установлена переменная окружения
  if (process.env.DISABLE_RATE_LIMIT === 'true' || 
      (process.env.NODE_ENV === 'development' && process.env.ENABLE_RATE_LIMIT !== 'true')) {
    return null;
  }

  const rateLimitConfig = typeof config === 'string' 
    ? RATE_LIMIT_CONFIGS[config]
    : config;

  const identifier = await getRateLimitIdentifier(request);
  const result = checkRateLimit(identifier, rateLimitConfig);

  if (!result.allowed) {
    const resetDate = new Date(result.resetAt);
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message: `Too many requests. Please try again after ${resetDate.toISOString()}`,
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitConfig.maxRequests.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.resetAt.toString(),
          'Retry-After': Math.ceil((result.resetAt - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  return null; // Лимит не превышен
}

