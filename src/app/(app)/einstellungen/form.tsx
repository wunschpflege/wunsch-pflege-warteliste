'use client';

import { useActionState } from 'react';
import type { Permission } from '@/lib/rbac';

type State = { ok: boolean; error?: string };
const init: State = { ok: false };

interface MenuRow {
  key: string;
  label: string;
  hasRead: boolean;   // ob "Nur lesen" sinnvoll ist
}

const MENU_ROWS: MenuRow[] = [
  { key: 'warteliste',     label: 'Warteliste',                  hasRead: true  },
  { key: 'haeuser',        label: 'Unsere Häuser & Archiv',      hasRead: false },
  { key: 'wiedervorlagen', label: 'Wiedervorlagen',              hasRead: false },
  { key: 'standorte',      label: 'Standorte',                   hasRead: false },
  { key: 'benutzer',       label: 'Benutzer & Einstellungen',    hasRead: false },
  { key: 'export',         label: 'Exporte (CSV/Excel/PDF)',      hasRead: false },
  { key: 'audit',          label: 'Audit-Protokoll',             hasRead: false },
];

const ROLES = [
  { key: 'PDL',        label: 'PDL' },
  { key: 'VERWALTUNG', label: 'Verwaltung' },
] as const;

// Berechnet aus flacher Permission-Liste den Zugriffsgrad pro Menüpunkt
function deriveAccess(
  perms: Permission[],
  menuKey: string,
): 'none' | 'read' | 'write' {
  const writeMap: Record<string, Permission[]> = {
    warteliste:     ['interessent.read', 'interessent.create', 'interessent.update', 'interessent.delete'],
    haeuser:        ['platz.manage'],
    wiedervorlagen: ['wiedervorlage.manage'],
    standorte:      ['standort.manage'],
    benutzer:       ['user.manage'],
    export:         ['export'],
    audit:          ['audit.read'],
  };
  const readMap: Record<string, Permission[]> = {
    warteliste: ['interessent.read'],
  };
  const writePerms = writeMap[menuKey] ?? [];
  const readPerms  = readMap[menuKey]  ?? [];
  if (writePerms.every((p) => perms.includes(p))) return 'write';
  if (readPerms.length > 0 && readPerms.every((p) => perms.includes(p))) return 'read';
  return 'none';
}

interface Props {
  action: (prev: State, fd: FormData) => Promise<State>;
  matrix: { PDL: string[]; VERWALTUNG: string[] };
}

const TILE_BASE = 'flex-1 text-center text-xs py-2 px-1 rounded-lg border cursor-pointer transition-colors select-none';
const TILE_ACTIVE_NONE  = 'bg-gray-100 border-gray-300 text-gray-700 font-medium';
const TILE_ACTIVE_READ  = 'bg-blue-50 border-blue-400 text-blue-700 font-medium';
const TILE_ACTIVE_WRITE = 'bg-brand-600 border-brand-600 text-white font-medium';
const TILE_INACTIVE     = 'bg-white border-gray-200 text-gray-400 hover:border-gray-300';

export default function EinstellungenForm({ action, matrix }: Props) {
  const [state, formAction, pending] = useActionState(action, init);

  return (
    <form action={formAction} className="space-y-1">
      {/* Header */}
      <div className="grid gap-4 mb-3" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <div />
        {ROLES.map((r) => (
          <div key={r.key} className="text-center text-xs font-semibold uppercase tracking-wide text-muted">
            {r.label}
          </div>
        ))}
      </div>

      {/* Rows */}
      {MENU_ROWS.map((row) => (
        <div
          key={row.key}
          className="grid gap-4 items-center py-3 border-b border-[var(--border)] last:border-0"
          style={{ gridTemplateColumns: '1fr 1fr 1fr' }}
        >
          {/* Label */}
          <span className="text-sm font-medium">{row.label}</span>

          {/* Role columns */}
          {ROLES.map((role) => {
            const current = deriveAccess(
              matrix[role.key] as Permission[],
              row.key,
            );
            return (
              <div key={role.key} className="flex gap-1.5">
                {/* Kein Zugriff */}
                <label className="flex-1">
                  <input
                    type="radio"
                    name={`${role.key}_${row.key}`}
                    value="none"
                    defaultChecked={current === 'none'}
                    className="sr-only peer"
                  />
                  <span className={`${TILE_BASE} peer-checked:${TILE_ACTIVE_NONE} ${current !== 'none' ? TILE_INACTIVE : ''}`}
                    style={current === 'none' ? { backgroundColor: '#f3f4f6', borderColor: '#d1d5db', color: '#374151', fontWeight: 500 } : {}}>
                    Kein Zugriff
                  </span>
                </label>

                {/* Nur lesen */}
                {row.hasRead && (
                  <label className="flex-1">
                    <input
                      type="radio"
                      name={`${role.key}_${row.key}`}
                      value="read"
                      defaultChecked={current === 'read'}
                      className="sr-only peer"
                    />
                    <span className={`${TILE_BASE} ${current !== 'read' ? TILE_INACTIVE : ''}`}
                      style={current === 'read' ? { backgroundColor: '#eff6ff', borderColor: '#60a5fa', color: '#1d4ed8', fontWeight: 500 } : {}}>
                      Nur lesen
                    </span>
                  </label>
                )}

                {/* Lesen & Ändern */}
                <label className="flex-1">
                  <input
                    type="radio"
                    name={`${role.key}_${row.key}`}
                    value="write"
                    defaultChecked={current === 'write'}
                    className="sr-only peer"
                  />
                  <span className={`${TILE_BASE} ${current !== 'write' ? TILE_INACTIVE : ''}`}
                    style={current === 'write' ? { backgroundColor: '#dc2626', borderColor: '#dc2626', color: '#ffffff', fontWeight: 500 } : {}}>
                    {row.hasRead ? 'Lesen & Ändern' : 'Zugriff'}
                  </span>
                </label>
              </div>
            );
          })}
        </div>
      ))}

      {/* Geschäftsführung – immer Vollzugriff */}
      <p className="text-xs text-muted pt-2">
        Die Geschäftsführung hat immer Vollzugriff auf alle Bereiche.
      </p>

      {state.error && <p className="text-sm text-red-600 mt-3">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700 mt-3">✓ Berechtigungen gespeichert.</p>}

      <div className="mt-5 flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Speichern…' : 'Berechtigungen speichern'}
        </button>
        <p className="text-xs text-muted">Änderungen werden sofort wirksam.</p>
      </div>
    </form>
  );
}
