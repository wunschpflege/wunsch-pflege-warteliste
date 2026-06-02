import type { Role } from '@prisma/client';
import type { SessionUser } from './auth';

/**
 * Rollen- und Rechtesystem.
 * - GESCHAEFTSFUEHRUNG: Vollzugriff, Benutzerverwaltung, Standorte, Exporte
 * - PDL: Interessenten anlegen/bearbeiten, Wiedervorlagen, freie Plaetze
 * - VERWALTUNG: Interessenten anlegen/bearbeiten, Suche, Exporte
 */
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

const MATRIX: Record<Role, Permission[]> = {
  GESCHAEFTSFUEHRUNG: [
    'interessent.read', 'interessent.create', 'interessent.update', 'interessent.delete',
    'platz.manage', 'wiedervorlage.manage', 'standort.manage', 'user.manage',
    'export', 'audit.read',
  ],
  PDL: [
    'interessent.read', 'interessent.create', 'interessent.update',
    'platz.manage', 'wiedervorlage.manage', 'export',
  ],
  VERWALTUNG: [
    'interessent.read', 'interessent.create', 'interessent.update',
    'wiedervorlage.manage', 'export',
  ],
};

export function can(user: Pick<SessionUser, 'role'> | null, perm: Permission): boolean {
  if (!user) return false;
  return MATRIX[user.role]?.includes(perm) ?? false;
}

export function requirePermission(user: SessionUser | null, perm: Permission): void {
  if (!can(user, perm)) throw new Error('FORBIDDEN');
}

export const ROLE_LABEL: Record<Role, string> = {
  GESCHAEFTSFUEHRUNG: 'Geschäftsführung',
  PDL: 'PDL',
  VERWALTUNG: 'Verwaltung',
};
