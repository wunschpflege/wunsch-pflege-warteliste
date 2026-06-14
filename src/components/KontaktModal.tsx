'use client';

import { useState, useRef } from 'react';
import { letzterKontaktEintragen } from '@/app/(app)/warteliste/actions';
import { fmtDate } from '@/lib/labels';

interface Props {
  id: string;
  letzterKontakt: Date | string | null;
  platzAngebotenWg: string | null;
  platzAngebotenInfo: string | null;
  standorte: { id: string; name: string }[];
}

function heute() {
  return new Date().toISOString().slice(0, 10);
}

export default function KontaktModal({ id, letzterKontakt, platzAngebotenWg, platzAngebotenInfo, standorte }: Props) {
  const [offen, setOffen] = useState(false);
  const [pending, setPending] = useState(false);
  const datumRef = useRef<HTMLInputElement>(null);

  const lk = letzterKontakt ? new Date(letzterKontakt) : null;
  const kontaktAlt = lk && Math.floor((Date.now() - lk.getTime()) / 86_400_000) > 30;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    try {
      await letzterKontaktEintragen(id, new FormData(e.currentTarget));
      setOffen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOffen(true)}
        className={`text-left hover:underline ${kontaktAlt ? 'text-orange-600 font-medium' : lk ? 'text-[var(--text)]' : 'text-muted'}`}
      >
        {lk ? (
          <span>{fmtDate(lk)}{kontaktAlt && ' ⚠'}</span>
        ) : (
          <span className="text-xs">Eintragen</span>
        )}
      </button>

      {offen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOffen(false)} />
          <div className="relative bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-semibold text-base">Kontakt eintragen</h2>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="label">Letztes Telefonat am *</label>
                <input
                  ref={datumRef}
                  type="date"
                  name="letzterKontakt"
                  defaultValue={heute()}
                  required
                  className="input cursor-pointer"
                  onClick={() => datumRef.current?.showPicker?.()}
                />
              </div>

              <div className="border-t border-[var(--border)] pt-3">
                <p className="text-xs text-muted mb-2 font-medium">Zimmer angeboten? (optional)</p>
                <div className="space-y-2">
                  <div>
                    <label className="label text-xs">Einrichtung / WG</label>
                    <select name="platzAngebotenWg" defaultValue={platzAngebotenWg ?? ''} className="select">
                      <option value="">– keine Angabe –</option>
                      {standorte.map((s) => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label text-xs">Zimmer von Bewohnerin/Bewohner</label>
                    <input
                      type="text"
                      name="platzAngebotenInfo"
                      defaultValue={platzAngebotenInfo ?? ''}
                      placeholder="z. B. Frau Meier"
                      className="input"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={pending} className="btn-primary flex-1">
                  {pending ? 'Speichern…' : 'Speichern'}
                </button>
                <button type="button" onClick={() => setOffen(false)} className="btn-ghost">
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
