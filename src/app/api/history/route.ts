import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - получить историю пользователя
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const history = await prisma.apiHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50 // Ограничиваем до 50 записей
    });

    return NextResponse.json(history);
  } catch (error) {
    console.error('Error fetching history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - сохранить запись в историю
export async function POST(request: NextRequest) {
  try {
    const { userId, prompt, mode, model, results } = await request.json();

    if (!userId || !prompt || !mode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const historyItem = await prisma.apiHistory.create({
      data: {
        userId,
        prompt,
        mode,
        model: model || null,
        results: results || null
      }
    });

    return NextResponse.json(historyItem);
  } catch (error) {
    console.error('Error saving history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}