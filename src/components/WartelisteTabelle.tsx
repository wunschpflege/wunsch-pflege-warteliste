'use client';

import { useState } from 'react';
import Link from 'next/link';
import { STATUS_LABEL, STATUS_COLOR, PFLEGEGRAD_LABEL, PRIO_LABEL, fmtDate } from '@/lib/labels';
import SchnellStatusSelect from './SchnellStatusSelect';
import SortHeader from './SortHeader';
import { toggleMarkiert, bulkStatusAendern } from '@/app/(app)/warteliste/actions';
import ZimmerAngebotenModal from './ZimmerAngebotenModal';
import KontaktModal from './KontaktModal';

const statusOptions = Object.entries(STATUS_LABEL) as [string, string][];

interface Eintrag {
  id: string;
  vorname: string;
  nachname: string;
  pflegegrad: string;
  prioritaet: string;
  status: string;
  createdAt: Date | string;
  letzterKontakt: Date | string | null;
  schnellnotiz: string | null;
  markiert: boolean;
  telefonMobil: string | null;
  telefonFestnetz: string | null;
  angehoerigerVorname: string | null;
  angehoerigerNachname: string | null;
  platzAngebotenAm: Date | string | null;
  platzAngebotenInfo: string | null;
  platzAngebotenWg: string | null;
  rueckmeldungBis: Date | string | null;
  standort: { name: string } | null;
  wunschStandorte: { name: string }[];
  erstelltVon: { kuerzel: string };
}

interface Props {
  eintraege: Eintrag[];
  canUpdate: boolean;
  canDelete: boolean;
  sortBy: string;
  sortDir: string;
  baseFilterQs: string;
  abgelehnt?: boolean;
  standorte?: { id: string; name: string }[];
}

const PRIO_DOT: Record<string, string> = {
  DRINGEND: 'bg-red-500',
  HOCH: 'bg-orange-400',
  NORMAL: 'bg-gray-300',
  NIEDRIG: 'bg-gray-200',
};

function WgChips({ standorte }: { standorte: { name: string }[] }) {
  const [aufgeklappt, setAufgeklappt] = useState(false);
  if (standorte.length === 0) return <span className="text-muted text-xs">–</span>;
  const sichtbar = aufgeklappt ? standorte : standorte.slice(0, 2);
  const rest = standorte.length - 2;
  return (
    <div className="flex flex-wrap gap-1">
      {sichtbar.map((s) => (
        <span key={s.name} className="inline-block text-xs bg-brand-50 text-brand-700 border border-brand-200 rounded-md px-1.5 py-0.5 whitespace-nowrap">
          {s.name}
        </span>
      ))}
      {!aufgeklappt && rest > 0 && (
        <button
          type="button"
          onClick={() => setAufgeklappt(true)}
          className="inline-block text-xs bg-gray-100 text-gray-500 hover:bg-brand-50 hover:text-brand-700 rounded-md px-1.5 py-0.5 cursor-pointer transition-colors"
        >
          +{rest}
        </button>
      )}
      {aufgeklappt && standorte.length > 2 && (
        <button
          type="button"
          onClick={() => setAufgeklappt(false)}
          className="inline-block text-xs bg-gray-100 text-gray-500 hover:bg-gray-200 rounded-md px-1.5 py-0.5 cursor-pointer"
        >
          ↑
        </button>
      )}
    </div>
  );
}

export default function WartelisteTabelle({ eintraege, canUpdate, canDelete, sortBy, sortDir, baseFilterQs, abgelehnt, standorte = [] }: Props) {
  const [ausgewaehlt, setAusgewaehlt] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkPending, setBulkPending] = useState(false);
  const now = new Date();

  function toggleAlle() {
    if (ausgewaehlt.size === eintraege.length) setAusgewaehlt(new Set());
    else setAusgewaehlt(new Set(eintraege.map((e) => e.id)));
  }

  function toggle(id: string) {
    const neu = new Set(ausgewaehlt);
    if (neu.has(id)) neu.delete(id); else neu.add(id);
    setAusgewaehlt(neu);
  }

  async function handleBulk(e: React.FormEvent) {
    e.preventDefault();
    if (!bulkStatus || ausgewaehlt.size === 0) return;
    setBulkPending(true);
    try {
      await bulkStatusAendern([...ausgewaehlt], bulkStatus);
      setAusgewaehlt(new Set());
    } finally {
      setBulkPending(false);
    }
  }

  return (
    <>
      {ausgewaehlt.size > 0 && (
        <form onSubmit={handleBulk} className="flex items-center gap-3 p-3 mb-3 bg-brand-50 rounded-xl border border-brand-200">
          <span className="text-sm font-medium text-brand-700">{ausgewaehlt.size} ausgewählt</span>
          <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="select text-sm">
            <option value="">Status ändern auf…</option>
            {statusOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button type="submit" disabled={!bulkStatus || bulkPending} className="btn-primary text-sm">
            {bulkPending ? 'Wird angewendet…' : 'Anwenden'}
          </button>
          <button type="button" onClick={() => setAusgewaehlt(new Set())} className="btn-ghost text-sm">Aufheben</button>
        </form>
      )}

      {/* ── MOBILE: Karten-Layout ─────────────────────────────── */}
      <div className="md:hidden space-y-3">
        {eintraege.map((i) => {
          const wartetage = Math.floor((now.getTime() - new Date(i.createdAt).getTime()) / 86_400_000);
          const warteText = wartetage < 30 ? `${wartetage}d` : wartetage < 365 ? `${Math.floor(wartetage / 30)}M` : `${Math.floor(wartetage / 365)}J`;
          const randKlasse = !abgelehnt && wartetage >= 90 ? 'border-l-4 border-l-red-400' : !abgelehnt && wartetage >= 60 ? 'border-l-4 border-l-amber-400' : '';
          const letzterKontakt = i.letzterKontakt ? new Date(i.letzterKontakt) : null;
          const kontaktAlt = letzterKontakt && Math.floor((now.getTime() - letzterKontakt.getTime()) / 86_400_000) > 30;
          return (
            <div key={i.id} className={`card p-4 ${randKlasse}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <span className={`mt-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0 ${PRIO_DOT[i.prioritaet] ?? 'bg-gray-300'}`} />
                  <div className="min-w-0">
                    <Link href={`/warteliste/${i.id}`} className="font-semibold text-brand-600 leading-tight">
                      {i.nachname}, {i.vorname}
                    </Link>
                    <p className="text-xs text-muted mt-0.5">{warteText}{i.markiert && ' · ⭐'}</p>
                    {i.schnellnotiz && <p className="text-xs text-muted italic truncate">{i.schnellnotiz}</p>}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {canUpdate
                    ? <SchnellStatusSelect id={i.id} currentStatus={i.status} />
                    : <span className={`badge ${STATUS_COLOR[i.status as keyof typeof STATUS_COLOR]}`}>{STATUS_LABEL[i.status as keyof typeof STATUS_LABEL]}</span>}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div>
                  <p className="text-muted font-medium uppercase tracking-wide mb-0.5">Pflegegrad</p>
                  <span className="bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{PFLEGEGRAD_LABEL[i.pflegegrad as keyof typeof PFLEGEGRAD_LABEL]}</span>
                </div>
                {(i.angehoerigerVorname || i.angehoerigerNachname) && (
                  <div>
                    <p className="text-muted font-medium uppercase tracking-wide mb-0.5">Angehöriger</p>
                    <p>{i.angehoerigerVorname} {i.angehoerigerNachname}</p>
                    {(i.telefonMobil ?? i.telefonFestnetz) && (
                      <a href={`tel:${i.telefonMobil ?? i.telefonFestnetz}`} className="text-brand-600">{i.telefonMobil ?? i.telefonFestnetz}</a>
                    )}
                  </div>
                )}
                {i.wunschStandorte.length > 0 && (
                  <div className="col-span-2">
                    <p className="text-muted font-medium uppercase tracking-wide mb-0.5">Gewünschte WG/Wohnung</p>
                    <WgChips standorte={i.wunschStandorte} />
                  </div>
                )}
                {!abgelehnt && (
                  <div>
                    <p className="text-muted font-medium uppercase tracking-wide mb-0.5">Letzter Kontakt</p>
                    {canUpdate
                      ? <KontaktModal id={i.id} letzterKontakt={i.letzterKontakt} platzAngebotenWg={i.platzAngebotenWg} platzAngebotenInfo={i.platzAngebotenInfo} standorte={standorte} />
                      : <span className={kontaktAlt ? 'text-orange-600 font-medium' : 'text-muted'}>{letzterKontakt ? fmtDate(letzterKontakt) : '–'}</span>}
                  </div>
                )}
                {!abgelehnt && (
                  <div>
                    <p className="text-muted font-medium uppercase tracking-wide mb-0.5">Zimmer angeboten</p>
                    {canUpdate
                      ? <ZimmerAngebotenModal id={i.id} platzAngebotenAm={i.platzAngebotenAm} platzAngebotenInfo={i.platzAngebotenInfo} platzAngebotenWg={i.platzAngebotenWg} rueckmeldungBis={i.rueckmeldungBis} standorte={standorte} />
                      : i.platzAngebotenAm ? <span>{fmtDate(new Date(i.platzAngebotenAm))}</span> : <span className="text-muted">–</span>}
                  </div>
                )}
              </div>

              <div className="mt-3 pt-2.5 border-t border-[var(--border)] flex items-center justify-between">
                <span className="kuerzel text-xs">{i.erstelltVon.kuerzel}</span>
                <div className="flex items-center gap-3">
                  {canUpdate && (
                    <form action={toggleMarkiert.bind(null, i.id)}>
                      <button className="text-sm text-muted hover:text-amber-500 h-8 w-8 flex items-center justify-center" title={i.markiert ? 'Markierung entfernen' : 'Als wichtig markieren'}>
                        {i.markiert ? '★' : '☆'}
                      </button>
                    </form>
                  )}
                  <Link href={`/warteliste/${i.id}`} className="btn-ghost text-xs py-1.5">Öffnen →</Link>
                </div>
              </div>
            </div>
          );
        })}
        {eintraege.length === 0 && (
          <div className="card p-8 text-center text-muted text-sm">Keine Einträge gefunden.</div>
        )}
      </div>

      {/* ── DESKTOP: Tabellen-Layout ──────────────────────────── */}
      <div className="hidden md:block card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-[var(--border)]">
              <th className="th w-8 py-3">
                <input type="checkbox" checked={ausgewaehlt.size === eintraege.length && eintraege.length > 0} onChange={toggleAlle} className="h-4 w-4 accent-brand-600 cursor-pointer" />
              </th>
              <th className="th py-3">
                <SortHeader label="Name" field="nachname" currentSort={sortBy} currentDir={sortDir} baseUrl={`/warteliste?${baseFilterQs}`} />
              </th>
              <th className="th py-3">Angehöriger</th>
              <th className="th py-3">PG</th>
              <th className="th py-3">Gewünschte WG/Wohnung</th>
              {!abgelehnt && <th className="th py-3">Letzter Kontakt</th>}
              {!abgelehnt && <th className="th py-3">Zimmer angeboten</th>}
              <th className="th py-3">
                <SortHeader label="Status" field="status" currentSort={sortBy} currentDir={sortDir} baseUrl={`/warteliste?${baseFilterQs}`} />
              </th>
              <th className="th py-3">MA</th>
              <th className="th py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {eintraege.map((i) => {
              const wartetage = Math.floor((now.getTime() - new Date(i.createdAt).getTime()) / 86_400_000);
              const warteText = wartetage < 30 ? `${wartetage}d`
                : wartetage < 365 ? `${Math.floor(wartetage / 30)}M`
                : `${Math.floor(wartetage / 365)}J`;
              const zeilenKlasse = !abgelehnt && wartetage >= 90 ? 'border-l-4 border-l-red-400 bg-red-50/50' :
                                   !abgelehnt && wartetage >= 60 ? 'border-l-4 border-l-amber-400 bg-amber-50/50' : '';
              const letzterKontakt = i.letzterKontakt ? new Date(i.letzterKontakt) : null;
              const kontaktAlt = letzterKontakt && Math.floor((now.getTime() - letzterKontakt.getTime()) / 86_400_000) > 30;

              return (
                <tr key={i.id} className={`hover:bg-gray-50/70 transition-colors ${zeilenKlasse}`}>
                  <td className="td py-3">
                    <input type="checkbox" checked={ausgewaehlt.has(i.id)} onChange={() => toggle(i.id)} className="h-4 w-4 accent-brand-600 cursor-pointer" />
                  </td>
                  <td className="td py-3">
                    <div className="flex items-start gap-2 min-w-[140px]">
                      <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${PRIO_DOT[i.prioritaet] ?? 'bg-gray-300'}`} title={PRIO_LABEL[i.prioritaet as keyof typeof PRIO_LABEL]} />
                      <div>
                        <Link href={`/warteliste/${i.id}`} className="font-semibold text-brand-600 hover:underline leading-tight">
                          {i.nachname}, {i.vorname}
                        </Link>
                        <p className="text-xs text-muted mt-0.5">
                          {warteText}{i.markiert && ' · ⭐'}
                        </p>
                        {i.schnellnotiz && <p className="text-xs text-muted italic truncate max-w-[160px]">{i.schnellnotiz}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="td py-3">
                    {(i.angehoerigerVorname || i.angehoerigerNachname) ? (
                      <div>
                        <p className="whitespace-nowrap">{i.angehoerigerVorname} {i.angehoerigerNachname}</p>
                        <p className="text-xs text-muted">{i.telefonMobil ?? i.telefonFestnetz ?? ''}</p>
                      </div>
                    ) : <span className="text-muted">–</span>}
                  </td>
                  <td className="td py-3 whitespace-nowrap">
                    <span className="text-xs bg-gray-100 text-gray-600 rounded-md px-1.5 py-0.5">
                      {PFLEGEGRAD_LABEL[i.pflegegrad as keyof typeof PFLEGEGRAD_LABEL]}
                    </span>
                  </td>
                  <td className="td py-3 max-w-[200px]">
                    <WgChips standorte={i.wunschStandorte} />
                  </td>
                  {!abgelehnt && (
                    <td className="td py-3 whitespace-nowrap">
                      {canUpdate
                        ? <KontaktModal
                            id={i.id}
                            letzterKontakt={i.letzterKontakt}
                            platzAngebotenWg={i.platzAngebotenWg}
                            platzAngebotenInfo={i.platzAngebotenInfo}
                            standorte={standorte}
                          />
                        : <span className={kontaktAlt ? 'text-orange-600 font-medium' : 'text-muted'}>
                            {letzterKontakt ? fmtDate(letzterKontakt) : '–'}
                            {kontaktAlt && ' ⚠'}
                          </span>}
                    </td>
                  )}
                  {!abgelehnt && (
                    <td className="td py-3">
                      {canUpdate
                        ? <ZimmerAngebotenModal id={i.id} platzAngebotenAm={i.platzAngebotenAm} platzAngebotenInfo={i.platzAngebotenInfo} platzAngebotenWg={i.platzAngebotenWg} rueckmeldungBis={i.rueckmeldungBis} standorte={standorte} />
                        : i.platzAngebotenAm
                          ? <div>
                              <p className="text-xs font-medium">{fmtDate(new Date(i.platzAngebotenAm))}</p>
                              {i.platzAngebotenInfo && <p className="text-xs text-muted">{i.platzAngebotenInfo}</p>}
                            </div>
                          : <span className="text-muted">–</span>}
                    </td>
                  )}
                  <td className="td py-3">
                    {canUpdate
                      ? <SchnellStatusSelect id={i.id} currentStatus={i.status} />
                      : <span className={`badge ${STATUS_COLOR[i.status as keyof typeof STATUS_COLOR]}`}>{STATUS_LABEL[i.status as keyof typeof STATUS_LABEL]}</span>}
                  </td>
                  <td className="td py-3">
                    <span className="kuerzel text-xs">{i.erstelltVon.kuerzel}</span>
                  </td>
                  <td className="td py-3">
                    <div className="flex items-center gap-2">
                      <Link href={`/warteliste/${i.id}`} className="text-xs text-brand-600 hover:underline whitespace-nowrap">Öffnen</Link>
                      {canUpdate && (
                        <form action={toggleMarkiert.bind(null, i.id)}>
                          <button className="text-xs text-muted hover:text-amber-500" title={i.markiert ? 'Markierung entfernen' : 'Als wichtig markieren'}>
                            {i.markiert ? '★' : '☆'}
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {eintraege.length === 0 && (
              <tr><td colSpan={10} className="td text-center text-muted py-10">Keine Einträge gefunden.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Ende Desktop-Block */}
    </>
  );
}
