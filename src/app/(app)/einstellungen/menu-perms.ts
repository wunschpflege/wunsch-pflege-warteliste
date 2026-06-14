import type { Permission } from '@/lib/rbac';

export const MENU_PERM_MAP: Record<string, { read: Permission[]; write: Permission[] }> = {
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
