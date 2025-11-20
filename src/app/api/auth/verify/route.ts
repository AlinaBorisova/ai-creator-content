import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCachedToken, setCachedToken } from '@/lib/tokenCache';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    // Проверяем кэш сначала - это снижает нагрузку на БД
    const cached = getCachedToken(token);
    if (cached) {
      if (cached.valid && cached.user) {
        return NextResponse.json({
          valid: true,
          user: cached.user,
        });
      } else {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
    }

    // Если нет в кэше, запрашиваем из БД
    // ОПТИМИЗАЦИЯ: используем select вместо include для выбора только нужных полей
    const userToken = await prisma.apiToken.findFirst({
      where: {
        token,
        isActive: true,
      },
      select: {
        id: true,
        expiresAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!userToken) {
      // Кэшируем отрицательный результат, чтобы не запрашивать БД повторно
      setCachedToken(token, false);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Проверяем срок действия токена
    if (userToken.expiresAt && userToken.expiresAt < new Date()) {
      setCachedToken(token, false);
      return NextResponse.json({ error: 'Token expired' }, { status: 401 });
    }

    // Сохраняем в кэш успешный результат
    setCachedToken(token, true, {
      id: userToken.user.id,
      name: userToken.user.name,
      email: userToken.user.email || undefined,
    });

    return NextResponse.json({
      valid: true,
      user: {
        id: userToken.user.id,
        name: userToken.user.name,
        email: userToken.user.email,
      },
    });
  } catch (error) {
    console.error('Error verifying token:', error);

    // Обработка ошибок квоты БД
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      if (
        errorMessage.includes('data transfer quota') ||
        errorMessage.includes('exceeded') ||
        errorMessage.includes('quota')
      ) {
        return NextResponse.json(
          {
            error: 'Database quota exceeded. Please contact administrator.',
            code: 'DB_QUOTA_EXCEEDED',
          },
          { status: 503 } // Service Unavailable
        );
      }
    }

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