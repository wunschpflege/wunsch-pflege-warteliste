'use client';

import { useState } from 'react';
import Link from 'next/link';
import { STATUS_LABEL, STATUS_COLOR, PFLEGEGRAD_LABEL, PRIO_LABEL, fmtDate } from '@/lib/labels';
import SchnellStatusSelect from './SchnellStatusSelect';
import SortHeader from './SortHeader';
import { toggleMarkiert, bulkStatusAendern, deleteInteressent } from '@/app/(app)/warteliste/actions';

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
  rueckmeldungBis: Date | string | null;
  standort: { name: string } | null;
  erstelltVon: { kuerzel: string };
}

interface Props {
  eintraege: Eintrag[];
  canUpdate: boolean;
  canDelete: boolean;
  sortBy: string;
  sortDir: string;
  baseFilterQs: string;
}

export default function WartelisteTabelle({ eintraege, canUpdate, canDelete, sortBy, sortDir, baseFilterQs }: Props) {
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
        <form onSubmit={handleBulk} className="flex items-center gap-3 p-3 mb-3 bg-brand-50 dark:bg-brand-900/20 rounded-xl border border-brand-200 dark:border-brand-800">
          <span className="text-sm font-medium text-brand-700 dark:text-brand-300">{ausgewaehlt.size} ausgewählt</span>
          <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="select text-sm">
            <option value="">Status ändern auf...</option>
            {statusOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button type="submit" disabled={!bulkStatus || bulkPending} className="btn-primary text-sm">
            {bulkPending ? 'Wird angewendet…' : 'Anwenden'}
          </button>
          <button type="button" onClick={() => setAusgewaehlt(new Set())} className="btn-ghost text-sm">Aufheben</button>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-[var(--border)]">
            <tr>
              <th className="th w-8">
                <input type="checkbox" checked={ausgewaehlt.size === eintraege.length && eintraege.length > 0} onChange={toggleAlle} className="h-4 w-4 accent-brand-600 cursor-pointer" />
              </th>
              <th className="th">
                <SortHeader label="Name" field="nachname" currentSort={sortBy} currentDir={sortDir} baseUrl={`/warteliste?${baseFilterQs}`} />
              </th>
              <th className="th">Angehöriger</th>
              <th className="th">Pflegegrad</th>
              <th className="th">Standort</th>
              <th className="th">Letzter Kontakt</th>
              <th className="th">Zimmer angeboten</th>
              <th className="th">
                <SortHeader label="Status" field="status" currentSort={sortBy} currentDir={sortDir} baseUrl={`/warteliste?${baseFilterQs}`} />
              </th>
              <th className="th">MA</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {eintraege.map((i) => {
              const wartetage = Math.floor((now.getTime() - new Date(i.createdAt).getTime()) / 86_400_000);
              const zeilenKlasse = wartetage >= 90 ? 'border-l-4 border-l-red-500 bg-red-50' :
                                   wartetage >= 60 ? 'border-l-4 border-l-amber-400 bg-amber-50' : '';
              const rueckmeldungUeberfaellig = i.rueckmeldungBis && new Date(i.rueckmeldungBis) < now;
              const letzterKontakt = i.letzterKontakt ? new Date(i.letzterKontakt) : null;
              const kontaktAlt = letzterKontakt && Math.floor((now.getTime() - letzterKontakt.getTime()) / 86_400_000) > 30;
              const prioPunkt: Record<string, string> = {
                DRINGEND: 'bg-red-500',
                HOCH: 'bg-orange-400',
                NORMAL: 'bg-gray-300',
                NIEDRIG: 'bg-gray-200',
              };
              const warteText = wartetage < 30
                ? `${wartetage} Tage`
                : wartetage < 365
                  ? `${Math.floor(wartetage / 30)} Monate`
                  : `${Math.floor(wartetage / 365)} J. ${Math.floor((wartetage % 365) / 30)} M.`;
              return (
                <tr key={i.id} className={`border-b border-[var(--border)] last:border-0 ${zeilenKlasse}`}>
                  <td className="td">
                    <input type="checkbox" checked={ausgewaehlt.has(i.id)} onChange={() => toggle(i.id)} className="h-4 w-4 accent-brand-600 cursor-pointer" />
                  </td>
                  <td className="td">
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${prioPunkt[i.prioritaet] ?? 'bg-gray-300'}`}
                        title={PRIO_LABEL[i.prioritaet as keyof typeof PRIO_LABEL]}
                      />
                      <div>
                        <Link href={`/warteliste/${i.id}`} className="font-medium text-brand-600 hover:underline">
                          {i.nachname}, {i.vorname}
                        </Link>
                        <p className="text-xs text-muted">
                          {warteText}
                          {i.markiert && ' · ⭐'}
                        </p>
                        {i.schnellnotiz && <p className="text-xs text-muted italic">{i.schnellnotiz}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="td">
                    {(i.angehoerigerVorname || i.angehoerigerNachname)
                      ? <><span>{i.angehoerigerVorname} {i.angehoerigerNachname}</span><br /><span className="text-xs text-muted">{i.telefonMobil ?? i.telefonFestnetz ?? ''}</span></>
                      : '–'}
                  </td>
                  <td className="td whitespace-nowrap">{PFLEGEGRAD_LABEL[i.pflegegrad as keyof typeof PFLEGEGRAD_LABEL]}</td>
                  <td className="td whitespace-nowrap">{i.standort?.name ?? '–'}</td>
                  <td className="td text-sm whitespace-nowrap">
                    <span className={kontaktAlt ? 'text-orange-600 font-medium' : ''}>
                      {letzterKontakt ? fmtDate(letzterKontakt) : '–'}
                      {kontaktAlt && ' ⚠'}
                    </span>
                  </td>
                  <td className="td text-sm">
                    {i.platzAngebotenAm ? (
                      <div>
                        <p className="text-xs font-medium">{fmtDate(new Date(i.platzAngebotenAm))}</p>
                        {i.platzAngebotenInfo && <p className="text-xs text-muted">{i.platzAngebotenInfo}</p>}
                        {i.rueckmeldungBis && (
                          <p className={`text-xs font-medium ${rueckmeldungUeberfaellig ? 'text-red-600' : 'text-amber-600'}`}>
                            {rueckmeldungUeberfaellig ? '⚠ Überfällig' : '⏳'} bis {fmtDate(new Date(i.rueckmeldungBis))}
                          </p>
                        )}
                      </div>
                    ) : '–'}
                  </td>
                  <td className="td">
                    {canUpdate
                      ? <SchnellStatusSelect id={i.id} currentStatus={i.status} />
                      : <span className={`badge ${STATUS_COLOR[i.status as keyof typeof STATUS_COLOR]}`}>{STATUS_LABEL[i.status as keyof typeof STATUS_LABEL]}</span>
                    }
                  </td>
                  <td className="td"><span className="kuerzel">{i.erstelltVon.kuerzel}</span></td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <Link href={`/warteliste/${i.id}`} className="text-xs text-brand-600 hover:underline">Öffnen</Link>
                      {canUpdate && (
                        <form action={toggleMarkiert.bind(null, i.id)}>
                          <button className="text-xs" title={i.markiert ? 'Markierung entfernen' : 'Als wichtig markieren'}>
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
              <tr><td colSpan={10} className="td text-center text-muted py-8">Keine Einträge gefunden.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
