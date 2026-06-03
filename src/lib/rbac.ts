import type { Role } from '@prisma/client';
import type { SessionUser } from './auth';
import { prisma } from './prisma';

export type Permission =
  | 'interessent.read'
  | 'interessent.create'
  | 'interessent.update'
  | 'interessent.delete'
  | 'platz.manage'
  | 'wiedervorlage.manage'
  | 'standort.manage'
  | 'user.manage'
  | 'export'
  | 'audit.read';

export const ALL_PERMISSIONS: Permission[] = [
  'interessent.read', 'interessent.create', 'interessent.update', 'interessent.delete',
  'platz.manage', 'wiedervorlage.manage', 'standort.manage', 'user.manage',
  'export', 'audit.read',
];

export const PERMISSION_LABEL: Record<Permission, string> = {
  'interessent.read':   'Interessenten ansehen',
  'interessent.create': 'Interessenten anlegen',
  'interessent.update': 'Interessenten bearbeiten',
  'interessent.delete': 'Interessenten löschen',
  'platz.manage':       'Freie Plätze verwalten',
  'wiedervorlage.manage': 'Wiedervorlagen verwalten',
  'standort.manage':    'Standorte verwalten',
  'user.manage':        'Benutzerverwaltung',
  'export':             'Exporte (CSV/Excel/PDF)',
  'audit.read':         'Audit-Protokoll einsehen',
};

// Standard-Matrix (Fallback wenn DB nicht erreichbar)
const DEFAULT_MATRIX: Record<Role, Permission[]> = {
  GESCHAEFTSFUEHRUNG: [...ALL_PERMISSIONS],
  PDL: ['interessent.read', 'interessent.create', 'interessent.update', 'platz.manage', 'wiedervorlage.manage', 'export'],
  VERWALTUNG: ['interessent.read', 'interessent.create', 'interessent.update', 'wiedervorlage.manage', 'export'],
};

// Cache: lädt Matrix einmal pro Prozess-Instanz neu wenn sie geändert wurde
let cachedMatrix: Record<Role, Permission[]> | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 60_000; // 60 Sekunden

export async function getMatrix(): Promise<Record<Role, Permission[]>> {
  const now = Date.now();
  if (cachedMatrix && now < cacheExpiry) return cachedMatrix;
  try {
    const row = await prisma.systemSettings.findUnique({ where: { key: 'rbac_matrix' } });
    if (row) {
      cachedMatrix = JSON.parse(row.value) as Record<Role, Permission[]>;
      cacheExpiry = now + CACHE_TTL;
      return cachedMatrix;
    }
  } catch {}
  return DEFAULT_MATRIX;
}

export function invalidateMatrixCache(): void {
  cachedMatrix = null;
  cacheExpiry = 0;
}

// Synchrone Version mit Default-Fallback (für Middleware/Layout)
export function canSync(user: Pick<SessionUser, 'role'> | null, perm: Permission, matrix?: Record<Role, Permission[]>): boolean {
  if (!user) return false;
  const m = matrix ?? DEFAULT_MATRIX;
  return m[user.role]?.includes(perm) ?? false;
}

export function can(user: Pick<SessionUser, 'role'> | null, perm: Permission): boolean {
  if (!user) return false;
  // Synchroner Fallback auf Default-Matrix (für Server-Komponenten ohne await)
  const m = cachedMatrix ?? DEFAULT_MATRIX;
  return m[user.role]?.includes(perm) ?? false;
}

export function requirePermission(user: SessionUser | null, perm: Permission): void {
  if (!can(user, perm)) throw new Error('FORBIDDEN');
}

export const ROLE_LABEL: Record<Role, string> = {
  GESCHAEFTSFUEHRUNG: 'Geschäftsführung',
  PDL: 'PDL',
  VERWALTUNG: 'Verwaltung',
};
