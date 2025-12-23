import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { applyRateLimit } from '@/lib/rateLimit/middleware';

export async function DELETE(request: NextRequest) {
  try {
    // Проверка rate limit
    const rateLimitResponse = await applyRateLimit(request, 'HISTORY');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const mode = searchParams.get('mode');
    const model = searchParams.get('model');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const whereClause: { userId: string; mode?: string; model?: string } = { userId };
    if (mode) whereClause.mode = mode;
    if (model) whereClause.model = model;

    await prisma.apiHistory.deleteMany({
      where: whereClause
    });

    return NextResponse.json({ message: 'History cleared successfully' });
  } catch (error) {
    console.error('Error clearing history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}