import { PrismaClient } from '@prisma/client';

// Эта конструкция предотвращает создание множества экземпляров PrismaClient
// в среде разработки из-за горячей перезагрузки (hot-reloading).
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
