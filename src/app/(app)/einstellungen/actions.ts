'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { requirePermission, ALL_PERMISSIONS, invalidateMatrixCache } from '@/lib/rbac';
import { audit } from '@/lib/audit';
import type { Permission } from '@/lib/rbac';
import type { Role } from '@prisma/client';

type State = { ok: boolean; error?: string };

// Mapping Menüpunkt → Berechtigungen
const MENU_PERM_MAP: Record<string, { read: Permission[]; write: Permission[] }> = {
  warteliste: {
    read:  ['interessent.read'],
    write: ['interessent.read', 'interessent.create', 'interessent.update', 'interessent.delete'],
  },
  haeuser: {
    read:  [],
    write: ['platz.manage'],
  },
  wiedervorlagen: {
    read:  [],
    write: ['wiedervorlage.manage'],
  },
  standorte: {
    read:  [],
    write: ['standort.manage'],
  },
  benutzer: {
    read:  [],
    write: ['user.manage'],
  },
  export: {
    read:  [],
    write: ['export'],
  },
  audit: {
    read:  [],
    write: ['audit.read'],
  },
};

export async function saveMatrix(_prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  requirePermission(user, 'user.manage');

  const matrix: Record<Role, Permission[]> = {
    GESCHAEFTSFUEHRUNG: [...ALL_PERMISSIONS],
    PDL: [],
    VERWALTUNG: [],
  };

  for (const role of ['PDL', 'VERWALTUNG'] as Role[]) {
    const permSet = new Set<Permission>();
    for (const [menuKey, perms] of Object.entries(MENU_PERM_MAP)) {
      const val = fd.get(`${role}_${menuKey}`) as string | null;
      if (val === 'write') perms.write.forEach((p) => permSet.add(p));
      else if (val === 'read') perms.read.forEach((p) => permSet.add(p));
    }
    matrix[role] = [...permSet];
  }

  const { prisma } = await import('@/lib/prisma');
  await prisma.systemSettings.upsert({
    where: { key: 'rbac_matrix' },
    update: { value: JSON.stringify(matrix) },
    create: { key: 'rbac_matrix', value: JSON.stringify(matrix) },
  });

  invalidateMatrixCache();
  await audit(user, 'UPDATE', 'SystemSettings', 'rbac_matrix', 'Berechtigungsmatrix aktualisiert');
  revalidatePath('/einstellungen');
  return { ok: true };
}

export { MENU_PERM_MAP };
