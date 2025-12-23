import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth/tokenVerification';
import { getCachedToken } from '@/lib/tokenCache';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('authToken')?.value ||
    request.headers.get('authorization')?.replace('Bearer ', '');

  // Защищаем страницы /ai и /parser
  if (request.nextUrl.pathname.startsWith('/ai') ||
    request.nextUrl.pathname.startsWith('/parser')) {

    if (!token) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Проверяем валидность токена
    // Сначала проверяем кэш для быстрой проверки
    const cached = getCachedToken(token);

    if (cached) {
      // Если токен в кэше и невалиден - редирект
      if (!cached.valid) {
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
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Токен валиден - пропускаем запрос
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/ai/:path*', '/parser/:path*']
};