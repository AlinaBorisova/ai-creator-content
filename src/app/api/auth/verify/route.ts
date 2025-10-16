import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const userToken = await prisma.apiToken.findUnique({
      where: { token, isActive: true },
      include: { user: true }
    });

    if (!userToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Проверяем срок действия
    if (userToken.expiresAt && userToken.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Token expired' }, { status: 401 });
    }

    return NextResponse.json({ 
      valid: true,
      user: {
        id: userToken.user.id,
        name: userToken.user.name,
        email: userToken.user.email
      }
    });
  } catch (error) {
    console.error('Error verifying token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}