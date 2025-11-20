import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - получить историю пользователя
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const mode = searchParams.get('mode');
    const model = searchParams.get('model');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100); // Максимум 100
    const skip = (page - 1) * limit;

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const whereClause = {
      userId,
      ...(mode && { mode }),
      ...(model && { model }),
    };

    // ОПТИМИЗАЦИЯ: для режима images загружаем results для превью
    // Для остальных режимов results не загружаются (экономия bandwidth)
    const shouldIncludeResults = mode === 'images';

    const [history, total] = await Promise.all([
      prisma.apiHistory.findMany({
        where: whereClause,
        select: {
          id: true,
          userId: true,
          prompt: true,
          mode: true,
          model: true,
          createdAt: true,
          // results включаем только для режима images (для превью)
          ...(shouldIncludeResults && { results: true }),
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.apiHistory.count({
        where: whereClause,
      }),
    ]);

    return NextResponse.json({
      history,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
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