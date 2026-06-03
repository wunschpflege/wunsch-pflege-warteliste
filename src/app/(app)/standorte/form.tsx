'use client';

import { useActionState, useRef, useEffect } from 'react';

type State = { ok: boolean; error?: string };
const init: State = { ok: false };

interface Defaults {
  name?: string;
  strasse?: string;
  hausnummer?: string;
  plz?: string;
  bemerkungen?: string;
  aktiv?: boolean;
}

export default function StandortFormClient({
  action, title, submitLabel, defaults,
}: {
  action: (prev: State, fd: FormData) => Promise<State>;
  title: string;
  submitLabel: string;
  defaults?: Defaults;
}) {
  const [state, formAction, pending] = useActionState(action, init);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && !defaults) ref.current?.reset();
  }, [state.ok, defaults]);

  return (
    <form ref={ref} action={formAction} className="card p-5 space-y-4">
      <h2 className="font-semibold">{title}</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="sm:col-span-2 lg:col-span-4">
          <label className="label">Name *</label>
          <input name="name" className="input" required defaultValue={defaults?.name ?? ''} placeholder="z. B. WG Sölde" />
        </div>
        <div className="lg:col-span-2">
          <label className="label">Straße</label>
          <input name="strasse" className="input" defaultValue={defaults?.strasse ?? ''} placeholder="Musterstraße" />
        </div>
        <div>
          <label className="label">Hausnummer</label>
          <input name="hausnummer" className="input" defaultValue={defaults?.hausnummer ?? ''} placeholder="12a" />
        </div>
        <div>
          <label className="label">Postleitzahl</label>
          <input name="plz" className="input" defaultValue={defaults?.plz ?? ''} placeholder="44287" />
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <label className="label">Bemerkungen</label>
          <textarea name="bemerkungen" rows={2} className="textarea" defaultValue={defaults?.bemerkungen ?? ''} />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" name="aktiv" defaultChecked={defaults?.aktiv ?? true} />
          <span>Aktiv</span>
        </label>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && (
        <p className="text-sm text-green-700">
          ✓ Gespeichert.{' '}
          {defaults && <a href="/standorte" className="underline">Zurück zur Liste</a>}
        </p>
      )}
      <div className="flex gap-3">
        <button className="btn-primary" disabled={pending}>{pending ? 'Speichern…' : submitLabel}</button>
        {defaults && <a href="/standorte" className="btn-ghost">Abbrechen</a>}
      </div>
    </form>
  );
}
