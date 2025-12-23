import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { applyRateLimit } from '@/lib/rateLimit/middleware';

// GET - получить один элемент истории с результатами
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Проверка rate limit
    const rateLimitResponse = await applyRateLimit(request, 'HISTORY');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    const { id } = await params;
    
    const historyItem = await prisma.apiHistory.findUnique({
      where: { id },
      // Загружаем все поля, включая results
    });

    if (!historyItem) {
      return NextResponse.json({ error: 'History item not found' }, { status: 404 });
    }

    return NextResponse.json(historyItem);
  } catch (error) {
    console.error('Error fetching history item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Проверка rate limit
    const rateLimitResponse = await applyRateLimit(request, 'HISTORY');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    const { id } = await params;
    
    await prisma.apiHistory.delete({
      where: { id }
    });

    return NextResponse.json({ message: 'History item deleted successfully' });
  } catch (error) {
    console.error('Error deleting history item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}