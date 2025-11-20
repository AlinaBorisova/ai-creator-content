import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { invalidateToken } from '@/lib/tokenCache';

export async function POST(request: NextRequest) {
  try {
    const { userName = 'Test User', userEmail = 'test@example.com' } = await request.json();

    // ОПТИМИЗАЦИЯ: используем транзакцию для атомарности операций
    const result = await prisma.$transaction(async (tx) => {
      // Создаем пользователя
      const user = await tx.apiUser.create({
        data: {
          name: userName,
          email: userEmail,
        },
      });

      // Создаем токен
      const token = randomBytes(32).toString('hex');

      const userToken = await tx.apiToken.create({
        data: {
          token,
          userId: user.id,
          name: 'Test Token',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 год
        },
      });

      return { user, userToken };
    });

    // Инвалидируем кэш для этого токена (если он там был)
    invalidateToken(result.userToken.token);

    return NextResponse.json({
      message: 'User and token created successfully',
      token: result.userToken.token,
      userId: result.user.id,
      userName: result.user.name,
    });
  } catch (error) {
    console.error('Error creating user and token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}