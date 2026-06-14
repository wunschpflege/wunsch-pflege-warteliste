'use client';

import { useRef } from 'react';
import SuchverlaufInput from './SuchverlaufInput';
import Link from 'next/link';

interface Standort { id: string; name: string; }
interface Mitarbeiter { id: string; kuerzel: string; vorname: string; nachname: string; }

const STATUS_OPTS: [string, string][] = [
  ['', 'Alle'],
  ['NEUE_ANFRAGE', 'Neue Anfrage'],
  ['WARTELISTE', 'Warteliste'],
  ['BESICHTIGUNG_GEPLANT', 'Besichtigung geplant'],
  ['AUFNAHME_IN_VORBEREITUNG', 'Aufnahme in Vorbereitung'],
  ['PLATZ_ANGEBOTEN', 'Platz angeboten'],
  ['EINGEZOGEN', 'Eingezogen'],
  ['ABGELEHNT', 'Abgelehnt'],
  ['ARCHIVIERT', 'Archiviert'],
];

const PG_OPTS: [string, string][] = [
  ['', 'Alle'],
  ['KEINER', 'Kein Pflegegrad'],
  ['PG1', 'Pflegegrad 1'],
  ['PG2', 'Pflegegrad 2'],
  ['PG3', 'Pflegegrad 3'],
  ['PG4', 'Pflegegrad 4'],
  ['PG5', 'Pflegegrad 5'],
];

export default function WartelisteSuche({
  standorte, mitarbeiter, defaults, nurMarkierte,
}: {
  standorte: Standort[];
  mitarbeiter: Mitarbeiter[];
  defaults: Record<string, string>;
  nurMarkierte: boolean;
}) {
  const vonRef = useRef<HTMLInputElement>(null);
  const bisRef = useRef<HTMLInputElement>(null);

  // Aktive Filter zählen für Badge
  const aktiveFilter = [defaults.q, defaults.standort, defaults.status, defaults.pflegegrad, defaults.mitarbeiter, defaults.von, defaults.bis, nurMarkierte ? '1' : ''].filter(Boolean).length;

  return (
    <details className="group card overflow-hidden" open={aktiveFilter > 0}>
      <summary className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors list-none">
        <div className="flex items-center gap-3">
          <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          <span className="font-medium text-sm">Filter / Suche</span>
          {aktiveFilter > 0 && (
            <span className="bg-brand-600 text-white text-xs rounded-full h-5 w-5 grid place-items-center font-semibold">{aktiveFilter}</span>
          )}
        </div>
        <svg className="h-4 w-4 text-muted transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>

      <div className="border-t border-[var(--border)] p-4">
        <form className="grid md:grid-cols-3 lg:grid-cols-4 gap-3" method="get">
          <input type="hidden" name="tab" value="interessenten" />
          <div className="lg:col-span-2">
            <label className="label">Suche (Name, Telefon, Angehörige)</label>
            <SuchverlaufInput name="q" defaultValue={defaults.q ?? ''} placeholder="z. B. Müller oder 0231…" />
          </div>
          <div>
            <label className="label">Standort</label>
            <select name="standort" defaultValue={defaults.standort ?? ''} className="select">
              <option value="">Alle</option>
              {standorte.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select name="status" defaultValue={defaults.status ?? ''} className="select">
              {STATUS_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Pflegegrad</label>
            <select name="pflegegrad" defaultValue={defaults.pflegegrad ?? ''} className="select">
              {PG_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Mitarbeiter</label>
            <select name="mitarbeiter" defaultValue={defaults.mitarbeiter ?? ''} className="select">
              <option value="">Alle</option>
              {mitarbeiter.map((m) => <option key={m.id} value={m.id}>{m.kuerzel} – {m.vorname} {m.nachname}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Von</label>
            <input
              ref={vonRef}
              type="date"
              name="von"
              defaultValue={defaults.von ?? ''}
              className="input cursor-pointer"
              onClick={() => vonRef.current?.showPicker?.()}
            />
          </div>
          <div>
            <label className="label">Bis</label>
            <input
              ref={bisRef}
              type="date"
              name="bis"
              defaultValue={defaults.bis ?? ''}
              className="input cursor-pointer"
              onClick={() => bisRef.current?.showPicker?.()}
            />
          </div>
          <div>
            <label className="label">&nbsp;</label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" name="markiert" value="1" defaultChecked={nurMarkierte} className="h-4 w-4 accent-brand-600" />
              Nur markierte ⭐
            </label>
          </div>
          <div className="flex items-end gap-2">
            <button className="btn-primary flex-1" type="submit">Filtern</button>
            <Link href="/warteliste?tab=interessenten" className="btn-ghost">Reset</Link>
          </div>
        </form>
      </div>
    </details>
  );
}
