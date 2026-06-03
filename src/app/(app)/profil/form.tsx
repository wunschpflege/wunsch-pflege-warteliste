'use client';

import { useActionState } from 'react';
import { changePin, type PinActionState } from './actions';

const init: PinActionState = { ok: false };

export default function PinForm() {
  const [state, formAction, pending] = useActionState(changePin, init);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2">{state.error}</p>
      )}
      {state.ok && (
        <p className="text-sm text-green-700 bg-green-50 dark:bg-green-900/30 rounded-lg px-3 py-2">PIN erfolgreich geändert.</p>
      )}

      <div>
        <label className="label" htmlFor="aktPin">Aktuelle PIN (4 Ziffern)</label>
        <input
          id="aktPin"
          name="aktPin"
          type="password"
          maxLength={4}
          pattern="\d{4}"
          className="input"
          placeholder="••••"
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="neuePin">Neue PIN (4 Ziffern)</label>
        <input
          id="neuePin"
          name="neuePin"
          type="password"
          maxLength={4}
          pattern="\d{4}"
          className="input"
          placeholder="••••"
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="pinBestaetigung">PIN bestätigen</label>
        <input
          id="pinBestaetigung"
          name="pinBestaetigung"
          type="password"
          maxLength={4}
          pattern="\d{4}"
          className="input"
          placeholder="••••"
          required
        />
      </div>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? 'Wird gespeichert…' : 'PIN ändern'}
      </button>
    </form>
  );
}
