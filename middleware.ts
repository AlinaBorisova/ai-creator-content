import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCachedToken } from '@/lib/tokenCache';

export async function middleware(request: NextRequest) {
  // Получаем токен из cookies или заголовка
  const cookieToken = request.cookies.get('authToken')?.value;
  const headerToken = request.headers.get('authorization')?.replace('Bearer ', '');
  const token = cookieToken || headerToken;

  // ВРЕМЕННОЕ логирование для отладки на Vercel
  console.log('[Middleware]', {
    path: request.nextUrl.pathname,
    search: request.nextUrl.search,
    fullPath: request.nextUrl.pathname + request.nextUrl.search,
    hasCookieToken: !!cookieToken,
    hasHeaderToken: !!headerToken,
    hasToken: !!token,
    cookies: request.cookies.getAll().map(c => `${c.name}=${c.value.substring(0, 10)}...`),
  });

  // Защищаем страницы /ai и /parser
  if (request.nextUrl.pathname.startsWith('/ai') ||
    request.nextUrl.pathname.startsWith('/parser')) {

    if (!token) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Redirecting: no token found');
      }
      return NextResponse.redirect(new URL('/', request.url));
    }

    // В middleware используем ТОЛЬКО кэш для проверки
    // Это необходимо, так как Prisma не работает в Edge Runtime
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

    // Если токена нет в кэше, пропускаем запрос
    // Полная проверка будет выполнена на уровне страницы через API
    // Это позволяет избежать ошибок Prisma в Edge Runtime
    // В production на Vercel это нормально, так как кэш должен быть заполнен
    // после первого успешного логина через API
    if (process.env.NODE_ENV === 'development') {
      console.log('Token not in cache, allowing access (will be verified on page level)');
    }
    
    // Пропускаем запрос - проверка будет на уровне страницы
    // Если токен невалиден, страница сама сделает редирект
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Это нужно для перехвата RSC запросов с query параметрами (?_rsc=...)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};