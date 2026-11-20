'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { meldeAbstandMs, warnVorlaufMs } from '@/lib/inaktiv';

// Automatische Abmeldung nach Inaktivitaet (Schutz fuer unbeaufsichtigte Geraete).
// Massgeblich ist der Server (src/lib/auth.ts); dieser Waechter sorgt dafuer, dass
//  - Eingaben ohne Anfrage (Lesen, Scrollen, Tippen in einem langen Formular) dem Server gemeldet werden,
//  - vor dem Ablauf ein Hinweis mit Zaehler erscheint,
//  - beim Ablauf abgemeldet und die Anmeldeseite mit Hinweis gezeigt wird.
// Die letzte Eingabe wird ueber localStorage mit den anderen Tabs geteilt, damit ein Tab den anderen
// nicht abmeldet.

const KEY_EINGABE = 'wp-warteliste:letzte-eingabe';
const KEY_ABGEMELDET = 'wp-warteliste:abgemeldet';
const EINGABE_DROSSEL_MS = 1000;
const EREIGNISSE = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

function lesen(key: string): number {
  try {
    const n = Number(window.localStorage.getItem(key));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function schreiben(key: string, wert: number): void {
  try {
    window.localStorage.setItem(key, String(wert));
  } catch {}
}

export default function InaktivWaechter({ minuten }: { minuten: number }) {
  const dauerMs = Math.round(minuten * 60_000);
  const warnMs = warnVorlaufMs(dauerMs);
  const meldeMs = meldeAbstandMs(dauerMs);

  const [restSek, setRestSek] = useState<number | null>(null); // null = kein Hinweis
  const [bereit, setBereit] = useState(false);
  const knopf = useRef<HTMLButtonElement>(null);
  const vorherFokus = useRef<Element | null>(null);

  const letzteEingabe = useRef(0);
  const letzteMeldung = useRef(0);
  const ungemeldet = useRef(false);
  const meldungLaeuft = useRef(false);
  const warnt = useRef(false);
  const beendet = useRef(false);

  const zurAnmeldung = useCallback(() => {
    const ziel = window.location.pathname + window.location.search;
    window.location.assign(`/login?abgemeldet=inaktiv&next=${encodeURIComponent(ziel)}`);
  }, []);

  /** Ablauf: Server-Abmeldung aufrufen, andere Tabs benachrichtigen, zur Anmeldeseite. */
  const abmelden = useCallback(async () => {
    if (beendet.current) return;
    beendet.current = true;
    schreiben(KEY_ABGEMELDET, Date.now());
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grund: 'inaktiv' }),
        keepalive: true,
      });
    } catch {}
    zurAnmeldung();
  }, [zurAnmeldung]);

  /** Dem Server sagen, dass es Eingaben gab (kleiner Endpunkt, verlaengert die Sitzung). */
  const melden = useCallback(async (keepalive = false) => {
    if (beendet.current || meldungLaeuft.current) return;
    meldungLaeuft.current = true;
    ungemeldet.current = false;
    letzteMeldung.current = Date.now();
    try {
      const res = await fetch('/api/auth/aktiv', { method: 'POST', keepalive });
      if (res.status === 401) {
        // Server hat die Sitzung schon beendet (z. B. Geraet war im Ruhezustand)
        beendet.current = true;
        const d = await res.json().catch(() => ({}));
        if (d?.code === 'inaktiv') {
          schreiben(KEY_ABGEMELDET, Date.now());
          zurAnmeldung();
        } else {
          window.location.assign('/login');
        }
      }
    } catch {
      ungemeldet.current = true; // keine Verbindung: beim naechsten Takt erneut
    } finally {
      meldungLaeuft.current = false;
    }
  }, [zurAnmeldung]);

  /** Laufende Pruefung: Hinweis zeigen, abmelden oder Eingaben melden. */
  const pruefen = useCallback(() => {
    if (beendet.current) return;
    const jetzt = Date.now();
    // Eingaben in einem anderen Tab zaehlen mit
    const geteilt = lesen(KEY_EINGABE);
    if (geteilt > letzteEingabe.current && geteilt <= jetzt + 5000) letzteEingabe.current = geteilt;

    const rest = letzteEingabe.current + dauerMs - jetzt;
    if (rest <= 0) {
      void abmelden();
      return;
    }
    if (rest <= warnMs) {
      warnt.current = true;
      setRestSek(Math.ceil(rest / 1000));
    } else if (warnt.current) {
      warnt.current = false;
      setRestSek(null);
    }
    if (ungemeldet.current && jetzt - letzteMeldung.current >= meldeMs) void melden();
  }, [abmelden, dauerMs, melden, meldeMs, warnMs]);

  const bleiben = useCallback(() => {
    const jetzt = Date.now();
    letzteEingabe.current = jetzt;
    schreiben(KEY_EINGABE, jetzt);
    warnt.current = false;
    setRestSek(null);
    void melden();
  }, [melden]);

  useEffect(() => {
    setBereit(true);
    // Die Seite wurde gerade vom Server geladen: das war Aktivitaet
    const start = Date.now();
    letzteEingabe.current = start;
    letzteMeldung.current = start;
    schreiben(KEY_EINGABE, start);

    const eingabe = () => {
      // Solange der Hinweis offen ist, zaehlt nur der Knopf "Angemeldet bleiben"
      if (beendet.current || warnt.current) return;
      const jetzt = Date.now();
      if (jetzt - letzteEingabe.current < EINGABE_DROSSEL_MS) return;
      // Kam die Eingabe erst nach dem Ablauf (Timer standen still), wird trotzdem abgemeldet
      if (jetzt - Math.max(letzteEingabe.current, lesen(KEY_EINGABE)) >= dauerMs) {
        pruefen();
        return;
      }
      letzteEingabe.current = jetzt;
      ungemeldet.current = true;
      schreiben(KEY_EINGABE, jetzt);
    };
    const speicher = (e: StorageEvent) => {
      if (e.key === KEY_ABGEMELDET && e.newValue && !beendet.current) {
        beendet.current = true;
        zurAnmeldung();
      } else if (e.key === KEY_EINGABE) {
        pruefen();
      }
    };
    // Zurueck im Tab / Geraet aufgeweckt: sofort pruefen (Timer stehen im Hintergrund still).
    // Beim Verlassen noch nicht gemeldete Eingaben gleich melden.
    const sichtbar = () => {
      if (document.visibilityState === 'hidden') {
        if (ungemeldet.current) void melden(true);
      } else {
        pruefen();
      }
    };

    const opts = { capture: true, passive: true } as const;
    for (const name of EREIGNISSE) window.addEventListener(name, eingabe, opts);
    window.addEventListener('storage', speicher);
    document.addEventListener('visibilitychange', sichtbar);
    window.addEventListener('pageshow', pruefen);
    window.addEventListener('focus', pruefen);
    const takt = window.setInterval(pruefen, 500);
    return () => {
      for (const name of EREIGNISSE) window.removeEventListener(name, eingabe, opts);
      window.removeEventListener('storage', speicher);
      document.removeEventListener('visibilitychange', sichtbar);
      window.removeEventListener('pageshow', pruefen);
      window.removeEventListener('focus', pruefen);
      window.clearInterval(takt);
    };
  }, [dauerMs, melden, pruefen, zurAnmeldung]);

  // Fokus auf den Knopf, solange der Hinweis offen ist; danach zurueck an die alte Stelle
  const offen = restSek !== null;
  useEffect(() => {
    if (!offen) return;
    vorherFokus.current = document.activeElement;
    knopf.current?.focus();
    const tab = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        knopf.current?.focus();
      }
    };
    document.addEventListener('keydown', tab, true);
    return () => {
      document.removeEventListener('keydown', tab, true);
      const alt = vorherFokus.current;
      if (alt instanceof HTMLElement && document.contains(alt)) alt.focus();
    };
  }, [offen]);

  if (!bereit || !offen) return null;

  return createPortal(
    <div className="inaktiv-hinweis" role="alertdialog" aria-modal="true" aria-labelledby="inaktiv-titel" aria-describedby="inaktiv-text">
      <div className="inaktiv-karte">
        <h2 id="inaktiv-titel" className="inaktiv-titel">Bist du noch da?</h2>
        <p id="inaktiv-text" className="inaktiv-text">
          Ohne Eingabe wirst du in{' '}
          <strong className="inaktiv-zahl" data-testid="inaktiv-rest">{restSek}</strong>{' '}
          {restSek === 1 ? 'Sekunde' : 'Sekunden'} abgemeldet.
        </p>
        <button ref={knopf} type="button" className="btn-primary inaktiv-knopf" onClick={bleiben}>
          Angemeldet bleiben
        </button>
      </div>
    </div>,
    document.body,
  );
}
