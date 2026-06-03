import { PrismaClient } from '@prisma/client';

// Singleton – wird in Production UND Development im globalen Scope gespeichert,
// damit keine neue DB-Verbindung pro Request geöffnet wird.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

// Immer cachen – nicht nur in Development!
globalForPrisma.prisma = prisma;
