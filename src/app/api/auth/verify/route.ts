import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenRequestSchema } from '@/lib/validations/schemas';
import { validateRequest } from '@/lib/validations/validator';
import { verifyToken } from '@/lib/auth/tokenVerification';
import { applyRateLimit } from '@/lib/rateLimit/middleware';

export async function POST(request: NextRequest) {
  try {
    // Проверка rate limit
    const rateLimitResponse = await applyRateLimit(request, 'AUTH');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    // Парсим и валидируем тело запроса
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Валидация входных данных
    const validation = await validateRequest(verifyTokenRequestSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { token } = validation.data;

    // Используем централизованную функцию проверки токена
    const verification = await verifyToken(token, true);

    if (!verification.valid) {
      // Обработка различных типов ошибок
      if (verification.error === 'QUOTA_EXCEEDED') {
        return NextResponse.json(
          {
            error: 'Database quota exceeded. Please contact administrator.',
            code: 'DB_QUOTA_EXCEEDED',
          },
          { status: 503 } // Service Unavailable
        );
      }

      if (verification.error === 'EXPIRED_TOKEN') {
        return NextResponse.json(
          { error: 'Token expired' },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Создаем ответ с установкой cookie
    const response = NextResponse.json({
      valid: true,
      user: verification.user,
    });

    // Устанавливаем cookie на сервере для работы на Vercel
    // Определяем production по наличию VERCEL_ENV или проверке URL
    // Для Vercel всегда используем secure, так как там всегда HTTPS
    const isProduction = process.env.VERCEL_ENV === 'production' || 
                        process.env.NODE_ENV === 'production';
    const isSecure = process.env.VERCEL === '1' || isProduction;

    response.cookies.set({
      name: 'authToken',
      value: token,
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 год в секундах
      httpOnly: false, // Нужно для доступа из JavaScript (для fallback)
      secure: isSecure, // Всегда true на Vercel
      sameSite: 'lax', // lax для лучшей совместимости с Vercel
    });

    return response;
  } catch (error) {
    console.error('Error verifying token:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details:
          process.env.NODE_ENV === 'development'
            ? error instanceof Error
              ? error.message
              : 'Unknown error'
            : undefined,
      },
      { status: 500 }
    );
  }
}