'use client';

import { useActionState, useRef, useEffect } from 'react';
import { GESCHLECHT_LABEL } from '@/lib/labels';

type State = { ok: boolean; error?: string };
const init: State = { ok: false };

export default function PlatzFormClient({
  action, standorte,
}: { action: (prev: State, fd: FormData) => Promise<State>; standorte: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(action, init);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state.ok]);

  return (
    <form ref={ref} action={formAction} className="card p-5 space-y-4">
      <h2 className="font-semibold">Freien Platz erfassen</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="label">Standort *</label>
          <select name="standortId" className="select" required>
            <option value="">– wählen –</option>
            {standorte.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Zimmernummer *</label>
          <input name="zimmernummer" className="input" required />
        </div>
        <div>
          <label className="label">Frei ab</label>
          <input type="date" name="freiAb" className="input" />
        </div>
        <div>
          <label className="label">Geschlecht bevorzugt</label>
          <select name="geschlechtPref" className="select" defaultValue="EGAL">
            {Object.entries(GESCHLECHT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2 lg:col-span-2">
          <label className="label">Bemerkungen</label>
          <input name="bemerkungen" className="input" />
        </div>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-600">Platz gespeichert.</p>}
      <button className="btn-primary" disabled={pending}>{pending ? 'Speichern…' : 'Platz anlegen'}</button>
    </form>
  );
}
