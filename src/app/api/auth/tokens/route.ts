import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { userName = 'Test User', userEmail = 'test@example.com' } = await request.json();

    // Создаем пользователя
    const user = await prisma.apiUser.create({
      data: {
        name: userName,
        email: userEmail
      }
    });

    // Создаем токен
    const token = randomBytes(32).toString('hex');
    
    const userToken = await prisma.apiToken.create({
      data: {
        token,
        userId: user.id,
        name: 'Test Token',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 год
      }
    });

    return NextResponse.json({ 
      message: 'User and token created successfully',
      token: userToken.token,
      userId: user.id,
      userName: user.name
    });
  } catch (error) {
    console.error('Error creating user and token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}