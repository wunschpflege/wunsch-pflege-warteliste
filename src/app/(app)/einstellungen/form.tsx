'use client';

import { useActionState, useState } from 'react';
import type { Permission } from '@/lib/rbac';

type State = { ok: boolean; error?: string };
const init: State = { ok: false };

type Access = 'none' | 'read' | 'write';

interface MenuRow {
  key: string;
  label: string;
  icon: string;
  hasRead: boolean;
}

const MENU_ROWS: MenuRow[] = [
  { key: 'warteliste',     label: 'Warteliste',               icon: '📋', hasRead: true  },
  { key: 'haeuser',        label: 'Unsere Häuser & Archiv',   icon: '🏠', hasRead: false },
  { key: 'wiedervorlagen', label: 'Wiedervorlagen',           icon: '🔔', hasRead: false },
  { key: 'standorte',      label: 'Standorte',                icon: '📍', hasRead: false },
  { key: 'benutzer',       label: 'Benutzer & Einstellungen', icon: '👤', hasRead: false },
  { key: 'export',         label: 'Exporte (CSV/Excel/PDF)',  icon: '📤', hasRead: false },
  { key: 'audit',          label: 'Audit-Protokoll',          icon: '🔍', hasRead: false },
];

const ROLES = [
  { key: 'PDL' as const,        label: 'PDL'        },
  { key: 'VERWALTUNG' as const, label: 'Verwaltung' },
];

function deriveAccess(perms: Permission[], menuKey: string): Access {
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
  if (writeMap[menuKey]?.every((p) => perms.includes(p))) return 'write';
  if (readMap[menuKey]?.length && readMap[menuKey].every((p) => perms.includes(p))) return 'read';
  return 'none';
}

type RoleKey = 'PDL' | 'VERWALTUNG';
type SelectionMap = Record<RoleKey, Record<string, Access>>;

function buildInitial(matrix: { PDL: string[]; VERWALTUNG: string[] }): SelectionMap {
  const result = {} as SelectionMap;
  for (const role of ROLES) {
    result[role.key] = {};
    for (const row of MENU_ROWS) {
      result[role.key][row.key] = deriveAccess(matrix[role.key] as Permission[], row.key);
    }
  }
  return result;
}

interface Props {
  action: (prev: State, fd: FormData) => Promise<State>;
  matrix: { PDL: string[]; VERWALTUNG: string[] };
}

function AccessBadge({
  value, current, hasRead, onChange,
}: {
  value: Access;
  current: Access;
  hasRead: boolean;
  onChange: (v: Access) => void;
}) {
  if (value === 'read' && !hasRead) return null;

  const active = current === value;

  const styles: Record<Access, string> = {
    none:  active ? 'bg-gray-200 text-gray-800 border-gray-300 font-semibold' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600',
    read:  active ? 'bg-blue-100 text-blue-700 border-blue-400 font-semibold' : 'bg-white text-gray-400 border-gray-200 hover:border-blue-300 hover:text-blue-600',
    write: active ? 'bg-brand-600 text-white border-brand-600 font-semibold shadow-sm' : 'bg-white text-gray-400 border-gray-200 hover:border-brand-400 hover:text-brand-600',
  };

  const labels: Record<Access, string> = {
    none:  'Kein Zugriff',
    read:  'Nur lesen',
    write: hasRead ? 'Lesen & Ändern' : 'Zugriff',
  };

  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${styles[value]}`}
    >
      {labels[value]}
    </button>
  );
}

export default function EinstellungenForm({ action, matrix }: Props) {
  const [state, formAction, pending] = useActionState(action, init);
  const [selection, setSelection] = useState<SelectionMap>(() => buildInitial(matrix));

  function setAccess(role: RoleKey, menuKey: string, value: Access) {
    setSelection((prev) => ({
      ...prev,
      [role]: { ...prev[role], [menuKey]: value },
    }));
  }

  return (
    <form action={formAction}>
      {/* Hidden inputs für Action */}
      {ROLES.map((role) =>
        MENU_ROWS.map((row) => (
          <input
            key={`${role.key}_${row.key}`}
            type="hidden"
            name={`${role.key}_${row.key}`}
            value={selection[role.key][row.key]}
          />
        ))
      )}

      {/* Header */}
      <div className="grid gap-6 mb-2 px-4" style={{ gridTemplateColumns: '2fr 3fr 3fr' }}>
        <div />
        {ROLES.map((r) => (
          <div key={r.key} className="text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-muted">{r.label}</span>
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        {MENU_ROWS.map((row, idx) => (
          <div
            key={row.key}
            className={`grid gap-6 items-center px-4 py-4 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}`}
            style={{ gridTemplateColumns: '2fr 3fr 3fr' }}
          >
            {/* Label */}
            <div className="flex items-center gap-2.5">
              <span className="text-base">{row.icon}</span>
              <span className="text-sm font-medium">{row.label}</span>
            </div>

            {/* Role columns */}
            {ROLES.map((role) => (
              <div key={role.key} className="flex items-center gap-2 justify-center flex-wrap">
                {(['none', 'read', 'write'] as Access[]).map((val) => (
                  <AccessBadge
                    key={val}
                    value={val}
                    current={selection[role.key][row.key]}
                    hasRead={row.hasRead}
                    onChange={(v) => setAccess(role.key, row.key, v)}
                  />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Geschäftsführung */}
      <div className="mt-3 flex items-center gap-2 text-xs text-muted">
        <span className="h-2 w-2 rounded-full bg-brand-600 inline-block" />
        Die Geschäftsführung hat immer Vollzugriff auf alle Bereiche.
      </div>

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
