import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  historyGetQuerySchema,
  historyPostRequestSchema
} from '@/lib/validations/schemas';
import {
  validateRequest,
  validateData,
  createValidationErrorResponse
} from '@/lib/validations/validator';

// GET - получить историю пользователя
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Преобразуем searchParams в объект для валидации
    const queryParams = {
      userId: searchParams.get('userId') || undefined,
      mode: searchParams.get('mode') || undefined,
      model: searchParams.get('model') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '50'
    };

    // Валидация query параметров
    const validation = validateData(historyGetQuerySchema, queryParams);
    
    if (!validation.success) {
      return createValidationErrorResponse(validation.error);
    }

    const { userId, mode, model, page, limit } = validation.data;
    const skip = (page - 1) * limit;

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
    const validation = await validateRequest(historyPostRequestSchema, body);
    
    if (!validation.success) {
      return validation.response;
    }

    const { userId, prompt, mode, model, results } = validation.data;

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