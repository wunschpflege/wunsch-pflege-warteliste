'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import DateInput from './DateInput';
import type { Interessent, Standort } from '@prisma/client';
import { STATUS_LABEL, PRIO_LABEL, PFLEGEGRAD_LABEL, fmtDateInput } from '@/lib/labels';
import type { ActionState } from '@/app/(app)/warteliste/actions';

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

const init: ActionState = { ok: false };

function Field({
  name, label, type = 'text', defaultValue, error, full, options, rows,
}: {
  name: string; label: string; type?: string; defaultValue?: string | null;
  error?: string; full?: boolean; options?: [string, string][]; rows?: number;
}) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="label" htmlFor={name}>{label}</label>
      {options ? (
        <select id={name} name={name} defaultValue={defaultValue ?? ''} className="select">
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      ) : rows ? (
        <textarea id={name} name={name} rows={rows} defaultValue={defaultValue ?? ''} className="textarea" />
      ) : type === 'date' ? (
        <DateInput id={name} name={name} defaultValue={defaultValue} />
      ) : (
        <input id={name} name={name} type={type} defaultValue={defaultValue ?? ''} className="input" />
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

export default function InteressentForm({
  action, standorte, data, submitLabel,
}: {
  action: Action;
  standorte: Pick<Standort, 'id' | 'name'>[];
  data?: Interessent | null;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, init);
  const router = useRouter();
  const fe = state.fieldErrors ?? {};

  const statusOpts = Object.entries(STATUS_LABEL) as [string, string][];
  const prioOpts = Object.entries(PRIO_LABEL) as [string, string][];
  const pgOpts = Object.entries(PFLEGEGRAD_LABEL) as [string, string][];
  const standortOpts: [string, string][] = [['', '– Kein Standort –'], ...standorte.map((s) => [s.id, s.name] as [string, string])];

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2">{state.error}</p>
      )}
      {state.ok && (
        <p className="text-sm text-green-700 bg-green-50 dark:bg-green-900/30 rounded-lg px-3 py-2">Gespeichert.</p>
      )}

      <section className="card p-5">
        <h2 className="font-semibold mb-4">Patientendaten</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field name="vorname" label="Vorname *" defaultValue={data?.vorname} error={fe.vorname} />
          <Field name="nachname" label="Nachname *" defaultValue={data?.nachname} error={fe.nachname} />
          <Field name="geburtsdatum" label="Geburtsdatum" type="date" defaultValue={fmtDateInput(data?.geburtsdatum)} />
          <Field name="pflegegrad" label="Pflegegrad" defaultValue={data?.pflegegrad ?? 'KEINER'} options={pgOpts} />
          <Field name="krankenkasse" label="Krankenkasse" defaultValue={data?.krankenkasse} />
          <Field name="gewuenschterEinzug" label="Gewünschter Einzugstermin" type="date" defaultValue={fmtDateInput(data?.gewuenschterEinzug)} />
          <Field name="wohnsituation" label="Aktuelle Wohnsituation" defaultValue={data?.wohnsituation} full />
          <Field name="diagnosen" label="Diagnosen" defaultValue={data?.diagnosen} rows={2} full />
          <Field name="mobilitaet" label="Mobilität" defaultValue={data?.mobilitaet} />
          <Field name="besonderheiten" label="Besonderheiten" defaultValue={data?.besonderheiten} />
          <Field name="bemerkungen" label="Bemerkungen" defaultValue={data?.bemerkungen} rows={3} full />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold mb-4">Angehöriger / Ansprechpartner</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field name="angehoerigerVorname" label="Vorname" defaultValue={data?.angehoerigerVorname} />
          <Field name="angehoerigerNachname" label="Nachname" defaultValue={data?.angehoerigerNachname} />
          <Field name="angehoerigerBeziehung" label="Beziehung zum Patienten" defaultValue={data?.angehoerigerBeziehung} full />
          <Field name="angStrasse" label="Straße" defaultValue={data?.angStrasse} />
          <Field name="angHausnummer" label="Hausnummer" defaultValue={data?.angHausnummer} />
          <Field name="angPlz" label="Postleitzahl" defaultValue={data?.angPlz} />
          <Field name="angOrt" label="Ort" defaultValue={data?.angOrt} />
          <Field name="telefonFestnetz" label="Telefon Festnetz" type="tel" defaultValue={data?.telefonFestnetz} />
          <Field name="telefonMobil" label="Telefon Mobil" type="tel" defaultValue={data?.telefonMobil} />
          <Field name="email" label="E-Mail-Adresse" type="email" defaultValue={data?.email} error={fe.email} full />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold mb-4">Aufnahmeinformationen</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field name="standortId" label="Gewünschte Einrichtung / Standort" defaultValue={data?.standortId} options={standortOpts} />
          <Field name="status" label="Status" defaultValue={data?.status ?? 'NEUE_ANFRAGE'} options={statusOpts} />
          <Field name="prioritaet" label="Priorität" defaultValue={data?.prioritaet ?? 'NORMAL'} options={prioOpts} />
        </div>
      </section>

      <div className="flex gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Speichern…' : submitLabel}
        </button>
        <button type="button" className="btn-ghost" onClick={() => router.back()}>Abbrechen</button>
      </div>
    </form>
  );
}
