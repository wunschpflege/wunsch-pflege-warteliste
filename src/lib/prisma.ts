import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    // Connection pooling: max 10 Verbindungen, 30s Timeout
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

// In Production: kein globales Caching nötig (Single-Instance auf Railway)
// In Development: verhindert Connection-Flooding beim Hot Reload
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
