import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    await prisma.apiHistory.delete({
      where: { id }
    });

    return NextResponse.json({ message: 'History item deleted' });
  } catch (error) {
    console.error('Error deleting history item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}