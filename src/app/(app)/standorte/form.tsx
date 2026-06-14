'use client';

import { useActionState, useRef, useEffect, useState, useCallback } from 'react';

type State = { ok: boolean; error?: string };
const init: State = { ok: false };

interface Defaults {
  name?: string;
  strasse?: string;
  hausnummer?: string;
  plz?: string;
  ort?: string;
  bemerkungen?: string;
  aktiv?: boolean;
}

export default function StandortFormClient({
  action, title, submitLabel, defaults,
}: {
  action: (prev: State, fd: FormData) => Promise<State>;
  title: string;
  submitLabel: string;
  defaults?: Defaults;
}) {
  const [state, formAction, pending] = useActionState(action, init);
  const ref = useRef<HTMLFormElement>(null);

  const [strasse,    setStrasse]    = useState(defaults?.strasse    ?? '');
  const [hausnummer, setHausnummer] = useState(defaults?.hausnummer ?? '');
  const [plz,        setPlz]        = useState(defaults?.plz        ?? '');
  const [ort,        setOrt]        = useState(defaults?.ort        ?? '');
  const [searching,  setSearching]  = useState(false);

  useEffect(() => {
    if (state.ok && !defaults) ref.current?.reset();
  }, [state.ok, defaults]);

  // Adresssuche via OpenStreetMap Nominatim
  const searchAddress = useCallback(async () => {
    if (!strasse || !hausnummer) return;
    setSearching(true);
    try {
      const query = encodeURIComponent(`${strasse} ${hausnummer}, Deutschland`);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${query}&format=json&addressdetails=1&limit=1&countrycodes=de`,
        { headers: { 'Accept-Language': 'de' } }
      );
      const data = await res.json();
      if (data?.[0]?.address) {
        const addr = data[0].address;
        if (addr.postcode) setPlz(addr.postcode);
        if (addr.city || addr.town || addr.village || addr.municipality) {
          setOrt(addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? '');
        }
      }
    } catch {
      // Stille Fehlerbehandlung – Nutzer kann manuell eintippen
    } finally {
      setSearching(false);
    }
  }, [strasse, hausnummer]);

  return (
    <form ref={ref} action={formAction} className="space-y-4">
      {title && <h2 className="font-semibold">{title}</h2>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Name */}
        <div className="sm:col-span-2 lg:col-span-4">
          <label className="label">Name *</label>
          <input name="name" className="input" required defaultValue={defaults?.name ?? ''} placeholder="z. B. WG Sölde" />
        </div>

        {/* Straße */}
        <div className="lg:col-span-2">
          <label className="label">Straße</label>
          <input
            name="strasse"
            className="input"
            value={strasse}
            onChange={(e) => setStrasse(e.target.value)}
            onBlur={searchAddress}
            placeholder="Musterstraße"
          />
        </div>

        {/* Hausnummer */}
        <div>
          <label className="label">Hausnummer</label>
          <input
            name="hausnummer"
            className="input"
            value={hausnummer}
            onChange={(e) => setHausnummer(e.target.value)}
            onBlur={searchAddress}
            placeholder="12a"
          />
        </div>

        {/* PLZ — auto-befüllt */}
        <div>
          <label className="label">
            Postleitzahl
            {searching && <span className="ml-1 text-[var(--muted)] normal-case font-normal">suche…</span>}
          </label>
          <input
            name="plz"
            className="input"
            value={plz}
            onChange={(e) => setPlz(e.target.value)}
            placeholder="44287"
          />
        </div>

        {/* Ort — auto-befüllt */}
        <div className="sm:col-span-2">
          <label className="label">
            Ort
            {searching && <span className="ml-1 text-[var(--muted)] normal-case font-normal">suche…</span>}
          </label>
          <input
            name="ort"
            className="input"
            value={ort}
            onChange={(e) => setOrt(e.target.value)}
            placeholder="Dortmund"
          />
        </div>

        {/* Bemerkungen */}
        <div className="sm:col-span-2 lg:col-span-4">
          <label className="label">Bemerkungen</label>
          <textarea name="bemerkungen" rows={2} className="textarea" defaultValue={defaults?.bemerkungen ?? ''} />
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" name="aktiv" defaultChecked={defaults?.aktiv ?? true} />
          <span>Aktiv</span>
        </label>
      </div>

      <p className="text-xs text-muted">
        PLZ und Ort werden automatisch ausgefüllt sobald Straße und Hausnummer eingetragen sind.
      </p>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && (
        <p className="text-sm text-green-700">
          ✓ Gespeichert.{' '}
          {defaults && <a href="/standorte" className="underline">Zurück zur Liste</a>}
        </p>
      )}
      <div className="flex gap-3">
        <button className="btn-primary" disabled={pending}>{pending ? 'Speichern…' : submitLabel}</button>
        {defaults && <a href="/standorte" className="btn-ghost">Abbrechen</a>}
      </div>
    </form>
  );
}
