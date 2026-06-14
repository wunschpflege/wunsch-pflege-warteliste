'use client';

import { useState, useRef } from 'react';
import { zimmerAnbieten } from '@/app/(app)/warteliste/actions';
import { fmtDate } from '@/lib/labels';

interface Props {
  id: string;
  platzAngebotenAm: Date | string | null;
  platzAngebotenInfo: string | null;
  platzAngebotenWg: string | null;
  rueckmeldungBis: Date | string | null;
}

function today() {
  return new Date().toISOString().split('T')[0];
}

export default function ZimmerAngebotenModal({ id, platzAngebotenAm, platzAngebotenInfo, platzAngebotenWg, rueckmeldungBis }: Props) {
  const [offen, setOffen] = useState(false);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const now = new Date();
  const ueberfaellig = rueckmeldungBis && new Date(rueckmeldungBis) < now;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    setPending(true);
    const fd = new FormData(formRef.current);
    await zimmerAnbieten(id, fd);
    setPending(false);
    setOffen(false);
  }

  return (
    <div className="relative">
      {platzAngebotenAm ? (
        <button
          type="button"
          onClick={() => setOffen(true)}
          className="text-left"
        >
          <p className="text-xs font-medium">{fmtDate(new Date(platzAngebotenAm))}</p>
          {platzAngebotenInfo && <p className="text-xs text-muted">{platzAngebotenInfo}</p>}
          {platzAngebotenWg && <p className="text-xs text-muted">{platzAngebotenWg}</p>}
          {rueckmeldungBis && (
            <p className={`text-xs font-medium ${ueberfaellig ? 'text-red-600' : 'text-amber-600'}`}>
              {ueberfaellig ? '⚠ Überfällig' : '⏳'} bis {fmtDate(new Date(rueckmeldungBis))}
            </p>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOffen(true)}
          className="text-xs text-brand-600 hover:underline whitespace-nowrap"
        >
          + Zimmer anbieten
        </button>
      )}

      {offen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOffen(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-base mb-4">Zimmer anbieten</h3>
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="label">Datum des Angebots</label>
                <input
                  type="date"
                  name="platzAngebotenAm"
                  defaultValue={platzAngebotenAm ? new Date(platzAngebotenAm).toISOString().split('T')[0] : today()}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Zimmer frei von</label>
                <input
                  type="text"
                  name="platzAngebotenInfo"
                  defaultValue={platzAngebotenInfo ?? ''}
                  placeholder="z. B. Frau Meier"
                  className="input"
                />
              </div>
              <div>
                <label className="label">Einrichtung / WG</label>
                <input
                  type="text"
                  name="platzAngebotenWg"
                  defaultValue={platzAngebotenWg ?? ''}
                  placeholder="z. B. WG Aplerbeck"
                  className="input"
                />
              </div>
              <div>
                <label className="label">Rückmeldung erwünscht bis</label>
                <input
                  type="date"
                  name="rueckmeldungBis"
                  defaultValue={rueckmeldungBis ? new Date(rueckmeldungBis).toISOString().split('T')[0] : ''}
                  className="input"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={pending} className="btn-primary flex-1">
                  {pending ? 'Speichern…' : 'Speichern'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setOffen(false)}>Abbrechen</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
