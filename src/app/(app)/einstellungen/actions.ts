'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { requirePermission, ALL_PERMISSIONS, DEFAULT_MATRIX, invalidateMatrixCache } from '@/lib/rbac';
import { audit } from '@/lib/audit';
import type { Permission } from '@/lib/rbac';
import type { Role } from '@prisma/client';

type State = { ok: boolean; error?: string };

export async function saveMatrix(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  requirePermission(user, 'user.manage');

  const matrix: Record<Role, Permission[]> = {
    GESCHAEFTSFUEHRUNG: [...ALL_PERMISSIONS], // immer Vollzugriff
    PDL: [],
    VERWALTUNG: [],
  };

  for (const role of ['PDL', 'VERWALTUNG'] as Role[]) {
    for (const perm of ALL_PERMISSIONS) {
      if (fd.get(`${role}_${perm}`) === 'on') {
        matrix[role].push(perm);
      }
    }
  }

  // Dynamischer Import — Prisma nur zur Laufzeit, nie beim Build
  const { prisma } = await import('@/lib/prisma');
  await prisma.systemSettings.upsert({
    where: { key: 'rbac_matrix' },
    update: { value: JSON.stringify(matrix) },
    create: { key: 'rbac_matrix', value: JSON.stringify(matrix) },
  });

  // Cache invalidieren damit neue Rechte sofort gelten
  invalidateMatrixCache();

  await audit(user, 'UPDATE', 'SystemSettings', 'rbac_matrix', 'Berechtigungsmatrix aktualisiert');
  revalidatePath('/einstellungen');
  return { ok: true };
}
