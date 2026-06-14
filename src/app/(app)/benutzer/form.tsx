'use client';

import { useActionState, useRef, useEffect, useState } from 'react';
import { ROLE_LABEL } from '@/lib/rbac';

type State = { ok: boolean; error?: string };
const init: State = { ok: false };

type Defaults = {
  vorname?: string;
  nachname?: string;
  username?: string;
  role?: string;
};

export default function UserFormClient({
  action,
  title,
  submitLabel,
  defaults,
  isEdit = false,
  resetOnSuccess = false,
}: {
  action: (prev: State, fd: FormData) => Promise<State>;
  title: string;
  submitLabel: string;
  defaults?: Defaults;
  isEdit?: boolean;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, init);
  const ref = useRef<HTMLFormElement>(null);
  const [vorname, setVorname] = useState(defaults?.vorname ?? '');
  const [nachname, setNachname] = useState(defaults?.nachname ?? '');

  const usernameVorschau = vorname && nachname
    ? `${vorname.trim()[0].toLowerCase()}.${nachname.trim().toLowerCase()}`
    : '';

  useEffect(() => {
    if (state.ok && resetOnSuccess) {
      ref.current?.reset();
      setVorname('');
      setNachname('');
    }
  }, [state.ok, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className="card p-5 space-y-4">
      <h2 className="font-semibold">{title}</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Vorname *</label>
          <input name="vorname" className="input" required value={vorname} onChange={(e) => setVorname(e.target.value)} />
        </div>
        <div>
          <label className="label">Nachname *</label>
          <input name="nachname" className="input" required value={nachname} onChange={(e) => setNachname(e.target.value)} />
        </div>
        <div>
          <label className="label">Rolle *</label>
          <select name="role" className="select" defaultValue={defaults?.role ?? 'VERWALTUNG'}>
            {Object.entries(ROLE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{isEdit ? 'Neue PIN (leer lassen = unverändert)' : 'Start-PIN * (4 Ziffern)'}</label>
          <input
            type="password"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            name="pin"
            className="input tracking-[0.5em] text-center text-xl"
            autoComplete="new-password"
            placeholder="••••"
          />
        </div>
      </div>
      {!isEdit && usernameVorschau && (
        <div>
          <label className="label">Benutzername (Vorschau)</label>
          <input
            className="input bg-gray-50 text-gray-400 cursor-default"
            value={usernameVorschau}
            readOnly
            tabIndex={-1}
          />
        </div>
      )}
      {defaults?.username && isEdit && (
        <p className="text-xs text-muted">
          Benutzername: <strong>{defaults.username}</strong>
        </p>
      )}
      {!isEdit && !usernameVorschau && (
        <p className="text-xs text-muted">
          Der Benutzername wird automatisch als <strong>ersterBuchstabe.nachname</strong> vergeben (z. B. Alexander Markus → <strong>a.markus</strong>).
        </p>
      )}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-600">Gespeichert.</p>}
      <button className="btn-primary" disabled={pending}>{pending ? 'Speichern…' : submitLabel}</button>
    </form>
  );
}
