import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth/tokenVerification';
import { getCachedToken } from '@/lib/tokenCache';

export async function middleware(request: NextRequest) {
  // Получаем токен из cookies или заголовка
  const cookieToken = request.cookies.get('authToken')?.value;
  const headerToken = request.headers.get('authorization')?.replace('Bearer ', '');
  const token = cookieToken || headerToken;

  // Логирование только в development
  if (process.env.NODE_ENV === 'development') {
    console.log('Middleware check:', {
      path: request.nextUrl.pathname,
      hasCookieToken: !!cookieToken,
      hasHeaderToken: !!headerToken,
      hasToken: !!token,
      cookies: request.cookies.getAll().map(c => c.name),
    });
  }

  // Защищаем страницы /ai и /parser
  if (request.nextUrl.pathname.startsWith('/ai') ||
    request.nextUrl.pathname.startsWith('/parser')) {

    if (!token) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Redirecting: no token found');
      }
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Проверяем валидность токена
    // Сначала проверяем кэш для быстрой проверки
    const cached = getCachedToken(token);

    if (cached) {
      // Если токен в кэше и невалиден - редирект
      if (!cached.valid) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Redirecting: token invalid in cache');
        }
        return NextResponse.redirect(new URL('/', request.url));
      }
      // Если токен валиден в кэше - пропускаем
      return NextResponse.next();
    }

    // Если токена нет в кэше, проверяем в БД
    // В middleware используем кэш для оптимизации
    const verification = await verifyToken(token, true);

    if (!verification.valid) {
      // Для ошибок квоты БД разрешаем доступ (временная проблема)
      // Пользователь сможет использовать кэшированные данные
      if (verification.error === 'QUOTA_EXCEEDED') {
        console.warn('Database quota exceeded in middleware, allowing access with cached data');
        return NextResponse.next();
      }

      // Для других ошибок - редирект
      if (process.env.NODE_ENV === 'development') {
        console.log('Redirecting: token verification failed', verification.error);
      }
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Токен валиден - пропускаем запрос
    // Также устанавливаем cookie для последующих запросов
    const response = NextResponse.next();
    if (!cookieToken && token) {
      // Устанавливаем cookie, если его нет, но токен валиден
      const isProduction = process.env.NODE_ENV === 'production';
      response.cookies.set({
        name: 'authToken',
        value: token,
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        httpOnly: false,
        secure: isProduction,
        sameSite: 'lax',
      });
    }
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/ai/:path*', '/parser/:path*']
};