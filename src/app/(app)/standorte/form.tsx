'use client';

import { useActionState, useRef, useEffect } from 'react';

type State = { ok: boolean; error?: string };
const init: State = { ok: false };

type Defaults = { strasse?: string | null; hausnummer?: string | null; plz?: string | null };

export default function StandortFormClient({
  action, title, submitLabel, defaults,
}: { action: (prev: State, fd: FormData) => Promise<State>; title: string; submitLabel: string; defaults?: Defaults }) {
  const [state, formAction, pending] = useActionState(action, init);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok]);

  return (
    <form ref={ref} action={formAction} className="card p-5 space-y-4">
      <h2 className="font-semibold">{title}</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Name *</label>
          <input name="name" className="input" required placeholder="z. B. WG Sölde" />
        </div>
        <div>
          <label className="label">Straße</label>
          <input name="strasse" className="input" defaultValue={defaults?.strasse ?? ''} />
        </div>
        <div>
          <label className="label">Hausnummer</label>
          <input name="hausnummer" className="input" defaultValue={defaults?.hausnummer ?? ''} />
        </div>
        <div>
          <label className="label">PLZ</label>
          <input name="plz" className="input" defaultValue={defaults?.plz ?? ''} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Bemerkungen</label>
          <textarea name="bemerkungen" rows={2} className="textarea" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="aktiv" defaultChecked /> Aktiv
        </label>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-600">Gespeichert.</p>}
      <button className="btn-primary" disabled={pending}>{pending ? 'Speichern…' : submitLabel}</button>
    </form>
  );
}
