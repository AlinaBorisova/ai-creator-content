import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/tokenVerification';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') ||
      (await request.json()).token;

    if (!token) {
      return NextResponse.json(
        { error: 'Token required' },
        { status: 400 }
      );
    }

    // Проверяем токен
    const verification = await verifyToken(token, true);

    if (!verification.valid) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Устанавливаем cookie
    // Для Vercel всегда используем secure, так как там всегда HTTPS
    const response = NextResponse.json({ success: true });
    const isProduction = process.env.VERCEL_ENV === 'production' || 
                        process.env.NODE_ENV === 'production';
    const isSecure = process.env.VERCEL === '1' || isProduction;

    response.cookies.set({
      name: 'authToken',
      value: token,
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: false,
      secure: isSecure,
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    console.error('Error setting cookie:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}