'use client';

import { useState } from 'react';
import { platzBelegen, platzFreigeben, platzAnlegen, platzLoeschen } from '@/app/(app)/plaetze/actions';
import { fmtDate } from '@/lib/labels';

interface Platz {
  id: string;
  zimmernummer: string;
  belegt: boolean;
  bewohnerName: string | null;
  belegtSeit: Date | string | null;
  standortId: string;
}

interface Standort {
  id: string;
  name: string;
}

interface Props {
  standorte: Standort[];
  plaetze: Platz[];
  canManage: boolean;
}

export default function PlaetzeClient({ standorte, plaetze, canManage }: Props) {
  const [offen, setOffen] = useState<Set<string>>(new Set());
  const [addOffen, setAddOffen] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<string | null>(null);

  function toggleWg(id: string) {
    const n = new Set(offen);
    n.has(id) ? n.delete(id) : n.add(id);
    setOffen(n);
  }

  function toggleAdd(id: string) {
    const n = new Set(addOffen);
    n.has(id) ? n.delete(id) : n.add(id);
    setAddOffen(n);
  }

  async function handleBelegen(platzId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(platzId);
    const fd = new FormData(e.currentTarget);
    await platzBelegen(platzId, fd);
    setPending(null);
  }

  async function handleFreigeben(platzId: string) {
    setPending(platzId);
    await platzFreigeben(platzId);
    setPending(null);
  }

  async function handleLoeschen(platzId: string) {
    if (!confirm('Zimmer wirklich löschen?')) return;
    setPending(platzId);
    await platzLoeschen(platzId);
    setPending(null);
  }

  async function handleAnlegen(standortId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending('new-' + standortId);
    const fd = new FormData(e.currentTarget);
    fd.set('standortId', standortId);
    await platzAnlegen(fd);
    e.currentTarget.reset();
    toggleAdd(standortId);
    setPending(null);
  }

  return (
    <div className="space-y-3">
      {standorte.map((s) => {
        const zimmer = plaetze.filter((p) => p.standortId === s.id);
        const freiCount = zimmer.filter((z) => !z.belegt).length;
        const istOffen = offen.has(s.id);
        const addIstOffen = addOffen.has(s.id);

        return (
          <div key={s.id} className="card overflow-hidden">
            {/* Header / Toggle */}
            <button
              type="button"
              onClick={() => toggleWg(s.id)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${freiCount > 0 ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="font-semibold">{s.name}</span>
                <span className="text-sm text-muted">{zimmer.length} Zimmer</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`badge ${freiCount > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                  {freiCount} frei
                </span>
                <svg className={`h-4 w-4 text-muted transition-transform ${istOffen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Inhalt */}
            {istOffen && (
              <div className="border-t border-[var(--border)] px-5 pb-4">
                {zimmer.length === 0 && (
                  <p className="text-sm text-muted py-3">Noch keine Zimmer erfasst.</p>
                )}
                <div className="divide-y divide-[var(--border)]">
                  {zimmer.map((z) => (
                    <div key={z.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${z.belegt ? 'bg-gray-400' : 'bg-green-500'}`} />
                        <div>
                          {z.bewohnerName
                            ? <p className="font-medium text-sm">{z.bewohnerName}</p>
                            : <p className="text-sm text-muted italic">Frei</p>}
                          {z.zimmernummer && z.zimmernummer !== '-' && (
                            <p className="text-xs text-muted">{z.zimmernummer}</p>
                          )}
                          {z.belegtSeit && (
                            <p className="text-xs text-muted">seit {fmtDate(z.belegtSeit instanceof Date ? z.belegtSeit : new Date(z.belegtSeit))}</p>
                          )}
                        </div>
                      </div>

                      {canManage && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {z.belegt ? (
                            <button
                              type="button"
                              disabled={pending === z.id}
                              onClick={() => handleFreigeben(z.id)}
                              className="text-xs px-3 py-1.5 rounded-lg border border-orange-300 text-orange-700 hover:bg-orange-50 disabled:opacity-50"
                            >
                              {pending === z.id ? '…' : 'Verstorben / ausgezogen'}
                            </button>
                          ) : (
                            <form onSubmit={(e) => handleBelegen(z.id, e)} className="flex items-center gap-2">
                              <input name="bewohnerName" className="input text-sm py-1 w-32" placeholder="Bewohnername" required />
                              <input type="date" name="belegtSeit" className="input text-sm py-1" />
                              <button type="submit" disabled={pending === z.id} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
                                {pending === z.id ? '…' : 'Belegen'}
                              </button>
                            </form>
                          )}
                          <button
                            type="button"
                            disabled={pending === z.id}
                            onClick={() => handleLoeschen(z.id)}
                            className="text-xs px-2 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Zimmer hinzufügen */}
                {canManage && (
                  <div className="mt-3">
                    {!addIstOffen ? (
                      <button
                        type="button"
                        onClick={() => toggleAdd(s.id)}
                        className="text-sm text-brand-600 hover:underline"
                      >
                        + Zimmer hinzufügen
                      </button>
                    ) : (
                      <form onSubmit={(e) => handleAnlegen(s.id, e)} className="flex flex-wrap items-end gap-3 pt-3 border-t border-[var(--border)]">
                        <div>
                          <label className="label text-xs">Bezeichnung (optional)</label>
                          <input name="zimmernummer" className="input text-sm py-1" placeholder="z. B. EG links" />
                        </div>
                        <div>
                          <label className="label text-xs">Bewohner</label>
                          <input name="bewohnerName" className="input text-sm py-1" placeholder="z. B. Frau Meier" />
                        </div>
                        <div>
                          <label className="label text-xs">Bewohnt seit</label>
                          <input type="date" name="belegtSeit" className="input text-sm py-1" />
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" disabled={pending === 'new-' + s.id} className="btn-primary text-sm disabled:opacity-50">
                            {pending === 'new-' + s.id ? '…' : 'Anlegen'}
                          </button>
                          <button type="button" onClick={() => toggleAdd(s.id)} className="btn-ghost text-sm">Abbrechen</button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
