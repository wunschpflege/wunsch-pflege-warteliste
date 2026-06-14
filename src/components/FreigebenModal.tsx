'use client';

import { useState, useRef } from 'react';
import { platzFreigeben } from '@/app/(app)/plaetze/actions';

const GRUND_OPTIONEN = [
  { value: 'VERSTORBEN', label: 'Verstorben' },
  { value: 'AUSGEZOGEN', label: 'Ausgezogen' },
  { value: 'UMGEZOGEN',  label: 'Umgezogen'  },
];

function heute() {
  return new Date().toISOString().slice(0, 10);
}

export default function FreigebenModal({ platzId }: { platzId: string }) {
  const [offen, setOffen] = useState(false);
  const [pending, setPending] = useState(false);
  const datumRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    try {
      await platzFreigeben(platzId, new FormData(e.currentTarget));
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
        className="text-xs px-3 py-1.5 rounded-lg border border-orange-300 text-orange-700 hover:bg-orange-50"
      >
        Verstorben / ausgezogen
      </button>

      {offen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOffen(false)} />
          <div className="relative bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-semibold text-base">Bewohner abmelden</h2>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="label">Grund *</label>
                <div className="flex gap-2">
                  {GRUND_OPTIONEN.map((g) => (
                    <label key={g.value} className="flex-1">
                      <input
                        type="radio"
                        name="auszugGrund"
                        value={g.value}
                        defaultChecked={g.value === 'AUSGEZOGEN'}
                        className="sr-only peer"
                      />
                      <span className="block text-center text-sm border border-[var(--border)] rounded-lg px-2 py-2 cursor-pointer peer-checked:bg-brand-600 peer-checked:text-white peer-checked:border-brand-600 hover:bg-gray-50 transition-colors">
                        {g.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Datum *</label>
                <input
                  ref={datumRef}
                  type="date"
                  name="auszugAm"
                  defaultValue={heute()}
                  required
                  className="input cursor-pointer"
                  onClick={() => datumRef.current?.showPicker?.()}
                  onFocus={() => datumRef.current?.showPicker?.()}
                />
              </div>

              <div>
                <label className="label">Bemerkung (optional)</label>
                <textarea
                  name="bemerkung"
                  rows={2}
                  className="textarea"
                  placeholder="z. B. Familie informiert, Zimmer geräumt"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={pending} className="btn-primary flex-1">
                  {pending ? 'Speichern…' : 'Speichern & archivieren'}
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
