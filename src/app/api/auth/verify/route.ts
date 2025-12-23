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
    // Определяем, нужно ли использовать secure (только для HTTPS)
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = [
      `authToken=${token}`,
      'path=/',
      'max-age=31536000', // 1 год
      isProduction ? 'secure' : '',
      'samesite=lax', // lax для лучшей совместимости с Vercel
    ].filter(Boolean).join('; ');

    response.headers.set('Set-Cookie', cookieOptions);

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