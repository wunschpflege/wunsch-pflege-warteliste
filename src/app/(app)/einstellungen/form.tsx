'use client';

import { useActionState } from 'react';

type State = { ok: boolean; error?: string };
const init: State = { ok: false };

interface Props {
  action: (prev: State, fd: FormData) => Promise<State>;
  matrix: { PDL: string[]; VERWALTUNG: string[] };
  permissions: string[];
  permissionLabels: Record<string, string>;
}

export default function EinstellungenForm({ action, matrix, permissions, permissionLabels }: Props) {
  const [state, formAction, pending] = useActionState(action, init);

  return (
    <form action={formAction}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="th text-left w-64">Berechtigung</th>
              <th className="th text-center">Geschäftsführung</th>
              <th className="th text-center">PDL</th>
              <th className="th text-center">Verwaltung</th>
            </tr>
          </thead>
          <tbody>
            {permissions.map((perm) => (
              <tr key={perm} className="border-b border-[var(--border)] last:border-0">
                <td className="td font-medium">{permissionLabels[perm] ?? perm}</td>
                <td className="td text-center">
                  <input type="checkbox" checked disabled className="h-4 w-4 accent-brand-600" readOnly />
                </td>
                <td className="td text-center">
                  <input
                    type="checkbox"
                    name={`PDL_${perm}`}
                    defaultChecked={matrix.PDL.includes(perm)}
                    className="h-4 w-4 accent-brand-600 cursor-pointer"
                  />
                </td>
                <td className="td text-center">
                  <input
                    type="checkbox"
                    name={`VERWALTUNG_${perm}`}
                    defaultChecked={matrix.VERWALTUNG.includes(perm)}
                    className="h-4 w-4 accent-brand-600 cursor-pointer"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
