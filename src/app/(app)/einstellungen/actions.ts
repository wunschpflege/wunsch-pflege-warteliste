'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { audit } from '@/lib/audit';
import { ALL_PERMISSIONS, type Permission } from '@/lib/rbac';

export type RoleKey = 'GESCHAEFTSFUEHRUNG' | 'PDL' | 'VERWALTUNG';

export interface RbacMatrix {
  GESCHAEFTSFUEHRUNG: Permission[];
  PDL: Permission[];
  VERWALTUNG: Permission[];
}

export const DEFAULT_MATRIX: RbacMatrix = {
  GESCHAEFTSFUEHRUNG: [...ALL_PERMISSIONS],
  PDL: ['interessent.read', 'interessent.create', 'interessent.update', 'platz.manage', 'wiedervorlage.manage', 'export'],
  VERWALTUNG: ['interessent.read', 'interessent.create', 'interessent.update', 'wiedervorlage.manage', 'export'],
};

export async function loadMatrix(): Promise<RbacMatrix> {
  try {
    const row = await prisma.systemSettings.findUnique({ where: { key: 'rbac_matrix' } });
    if (row) return JSON.parse(row.value) as RbacMatrix;
  } catch {}
  return DEFAULT_MATRIX;
}

export async function saveMatrix(_prev: { ok: boolean; error?: string }, fd: FormData): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  requirePermission(user, 'user.manage');

  const matrix: RbacMatrix = { GESCHAEFTSFUEHRUNG: [], PDL: [], VERWALTUNG: [] };
  const roles: RoleKey[] = ['GESCHAEFTSFUEHRUNG', 'PDL', 'VERWALTUNG'];

  // GESCHAEFTSFUEHRUNG immer Vollzugriff
  matrix.GESCHAEFTSFUEHRUNG = [...ALL_PERMISSIONS];

  for (const role of ['PDL', 'VERWALTUNG'] as RoleKey[]) {
    for (const perm of ALL_PERMISSIONS) {
      if (fd.get(`${role}_${perm}`) === 'on') {
        matrix[role].push(perm);
      }
    }
  }

  await prisma.systemSettings.upsert({
    where: { key: 'rbac_matrix' },
    update: { value: JSON.stringify(matrix) },
    create: { key: 'rbac_matrix', value: JSON.stringify(matrix) },
  });

  await audit(user, 'UPDATE', 'SystemSettings', 'rbac_matrix', 'Berechtigungsmatrix aktualisiert');
  revalidatePath('/einstellungen');
  return { ok: true };
}
