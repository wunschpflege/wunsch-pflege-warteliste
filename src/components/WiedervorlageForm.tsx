'use client';

import { useActionState, useRef, useEffect } from 'react';
import { WV_TYP_LABEL } from '@/lib/labels';
import { addWiedervorlage, type ActionState } from '@/app/(app)/warteliste/actions';

const init: ActionState = { ok: false };

export default function WiedervorlageForm({
  interessentId, compact,
}: { interessentId?: string; compact?: boolean }) {
  const [state, action, pending] = useActionState(addWiedervorlage, init);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok]);

  return (
    <form ref={ref} action={action} className="space-y-3">
      {interessentId && <input type="hidden" name="interessentId" value={interessentId} />}
      <div className={compact ? 'space-y-3' : 'grid sm:grid-cols-2 gap-3'}>
        <div>
          <label className="label">Typ</label>
          <select name="typ" className="select" defaultValue="WIEDERVORLAGE">
            {Object.entries(WV_TYP_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Fällig am *</label>
          <input type="date" name="faelligAm" className="input" required />
        </div>
      </div>
      <div>
        <label className="label">Titel *</label>
        <input name="titel" className="input" required placeholder="z. B. Rückruf Angehörige" />
      </div>
      <div>
        <label className="label">Notiz</label>
        <textarea name="notiz" rows={2} className="textarea" />
      </div>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state.ok && <p className="text-xs text-green-600">Wiedervorlage angelegt.</p>}
      <button className="btn-primary" disabled={pending}>{pending ? 'Speichern…' : 'Wiedervorlage anlegen'}</button>
    </form>
  );
}
