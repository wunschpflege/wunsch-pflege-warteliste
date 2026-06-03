import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

// Singleton: eine einzige Instanz für den gesamten Prozess
export const prisma = global.__prisma ?? createPrismaClient();
global.__prisma = prisma;
