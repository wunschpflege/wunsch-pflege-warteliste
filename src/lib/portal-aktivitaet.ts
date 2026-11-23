/**
 * Aktivitaet fuer das Wunsch-Pflege Portal (GET /api/portal/aktivitaet): wer hat was getan.
 * Reine Aufbereitung ohne Datenbankzugriff (dadurch einzeln testbar). Quelle ist der Audit-Trail.
 *
 * Datenschutz: Der Audit-Trail speichert in `details` Namen von Interessenten, Titel von
 * Wiedervorlagen, Namen bearbeiteter Konten und IP-Adressen. Davon wird NICHTS weitergegeben.
 * Jeder Text hier ist eine feste Zeichenkette aus diesem Programmcode, ausgewaehlt nach Aktion und
 * Art des Datensatzes. `details` wird hoechstens mit festen, vom Programm selbst geschriebenen
 * Werten verglichen (z. B. "erledigt", "deaktiviert"), nie in den Text uebernommen.
 * Genannt wird nur die handelnde Person (Anmeldename und Name), nie die betroffene.
 */

export type EreignisArt = 'angelegt' | 'geaendert' | 'erledigt' | 'geloescht' | 'anmeldung' | 'sonstiges';

export interface Ereignis {
  id: string;
  zeit: string;
  benutzername: string | null;
  name: string | null;
  art: EreignisArt;
  text: string;
  pfad?: string;
}

/** Eine Zeile des Audit-Trails, wie die Abfrage sie liefert. */
export interface AuditZeile {
  id: string;
  zeitpunkt: Date;
  aktion: string;
  entitaet: string;
  entitaetId: string | null;
  details: string | null;
  user: { username: string; vorname: string; nachname: string } | null;
}

/** Nur diese Aktionen sind Ereignisse. LOGOUT (auch automatisch) und EXPORT (Lesezugriff) nicht. */
export const EREIGNIS_AKTIONEN = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN'];

export const NEU_MAX = 50;
export const START_MAX = 10;
export const TEXT_MAX = 120;

/** Vermerk, den Aenderungen ueber das Portal im Audit-Trail tragen. */
export const PORTAL_VERMERK = 'über Portal';
const VERMERK_ENDE = ` – ${PORTAL_VERMERK}`;
/** Anfang des Audit-Textes einer Rollenaenderung ueber das Portal (siehe portalRolleAendern). */
export const ROLLE_GEAENDERT = 'Rolle geändert: ';

type Treffer = { art: EreignisArt; text: string; pfad?: string };

const BEZEICHNUNG: Record<string, { name: string; pfad?: string }> = {
  Interessent: { name: 'Interessent', pfad: '/warteliste' },
  Wiedervorlage: { name: 'Wiedervorlage', pfad: '/wiedervorlagen' },
  Standort: { name: 'Standort', pfad: '/standorte' },
  Platz: { name: 'Platz', pfad: '/plaetze' },
  User: { name: 'Benutzerkonto', pfad: '/benutzer' },
};

const CUID = /^[a-z0-9]{1,40}$/;

function zuordnen(z: Pick<AuditZeile, 'aktion' | 'entitaet' | 'entitaetId' | 'details'>): Treffer | null {
  const d = z.details ?? '';
  const portal = d.endsWith(VERMERK_ENDE);
  const zusatz = portal ? ' (über das Portal)' : '';

  if (z.aktion === 'LOGIN') {
    return { art: 'anmeldung', text: d.startsWith('Anmeldung über Portal') ? 'Anmeldung über das Portal' : 'Anmeldung' };
  }
  if (z.aktion !== 'CREATE' && z.aktion !== 'UPDATE' && z.aktion !== 'DELETE') return null;

  if (z.entitaet === 'SystemSettings') {
    return { art: 'geaendert', text: 'Berechtigungen geändert', pfad: '/einstellungen' };
  }

  const b = BEZEICHNUNG[z.entitaet] ?? { name: 'Eintrag' };
  if (z.aktion === 'CREATE') {
    const pfad =
      z.entitaet === 'Interessent' && z.entitaetId && CUID.test(z.entitaetId) ? `/warteliste/${z.entitaetId}` : b.pfad;
    return { art: 'angelegt', text: `${b.name} angelegt${zusatz}`, pfad };
  }
  if (z.aktion === 'DELETE') return { art: 'geloescht', text: `${b.name} gelöscht`, pfad: b.pfad };

  // UPDATE: Sonderfaelle nur ueber feste Werte, die das Programm selbst schreibt
  const kern = portal ? d.slice(0, -VERMERK_ENDE.length) : d;
  switch (z.entitaet) {
    case 'Interessent': {
      const pfad = z.entitaetId && CUID.test(z.entitaetId) ? `/warteliste/${z.entitaetId}` : b.pfad;
      const viele = /^Status geändert \((\d{1,6}) Datensätze\)$/.exec(d);
      if (viele) {
        const n = Number(viele[1]);
        return { art: 'geaendert', text: n === 1 ? 'Status eines Interessenten geändert' : `Status von ${n} Interessenten geändert`, pfad: b.pfad };
      }
      if (d === 'Status geändert') return { art: 'geaendert', text: 'Status eines Interessenten geändert', pfad };
      if (d === 'Zimmer angeboten') return { art: 'geaendert', text: 'Zimmer angeboten', pfad };
      if (d === 'Kontakt eingetragen') return { art: 'geaendert', text: 'Kontakt eingetragen', pfad };
      return { art: 'geaendert', text: 'Interessent geändert', pfad };
    }
    case 'Wiedervorlage':
      if (d === 'erledigt') return { art: 'erledigt', text: 'Wiedervorlage erledigt', pfad: b.pfad };
      if (d === 'wieder offen') return { art: 'geaendert', text: 'Wiedervorlage wieder geöffnet', pfad: b.pfad };
      break;
    case 'Standort':
      if (d === 'deaktiviert') return { art: 'geaendert', text: 'Standort deaktiviert', pfad: b.pfad };
      if (d === 'aktiviert') return { art: 'geaendert', text: 'Standort aktiviert', pfad: b.pfad };
      break;
    case 'Platz':
      if (d === 'als frei markiert') return { art: 'geaendert', text: 'Platz als frei markiert', pfad: b.pfad };
      if (d === 'als belegt markiert') return { art: 'geaendert', text: 'Platz als belegt markiert', pfad: b.pfad };
      if (d === 'belegt') return { art: 'geaendert', text: 'Platz belegt', pfad: b.pfad };
      if (d === 'freigegeben') return { art: 'geaendert', text: 'Platz freigegeben', pfad: b.pfad };
      break;
    case 'User':
      if (kern === 'deaktiviert') return { art: 'geaendert', text: `Benutzerkonto gesperrt${zusatz}`, pfad: b.pfad };
      if (kern === 'aktiviert') return { art: 'geaendert', text: `Benutzerkonto entsperrt${zusatz}`, pfad: b.pfad };
      if (d === 'PIN geändert') return { art: 'geaendert', text: 'Eigene PIN geändert', pfad: '/profil' };
      if (portal && d.startsWith(ROLLE_GEAENDERT)) {
        return { art: 'geaendert', text: `Rolle eines Benutzerkontos geändert${zusatz}`, pfad: b.pfad };
      }
      break;
  }
  return { art: 'geaendert', text: `${b.name} geändert`, pfad: b.pfad };
}

/** Bildet eine Zeile des Audit-Trails auf ein Ereignis ab; null, wenn sie kein Ereignis ist. */
export function ereignisAusAudit(z: AuditZeile): Ereignis | null {
  const t = zuordnen(z);
  if (!t) return null;
  const name = z.user ? `${z.user.vorname} ${z.user.nachname}`.trim() : '';
  return {
    id: z.id,
    zeit: z.zeitpunkt.toISOString(),
    benutzername: z.user ? z.user.username : null,
    name: name || null,
    art: t.art,
    text: t.text.slice(0, TEXT_MAX),
    ...(t.pfad ? { pfad: t.pfad } : {}),
  };
}

// ─── Marke ───────────────────────────────────────────────────────────────────
// Stelle im Audit-Trail: Zeitpunkt (Millisekunden) und Kennung der zuletzt gelieferten Zeile.
// Sortiert wird nach (Zeitpunkt, Kennung); die Marke waechst damit nur.

export interface Marke { zeit: Date; id: string }

/** Marke vor dem allerersten Eintrag. */
export const MARKE_ANFANG = '0-0';

export function markeBilden(zeit: Date, id: string): string {
  return `${zeit.getTime()}-${id}`;
}

/** Liest eine Marke; null, wenn sie fehlt oder nicht von hier stammt. */
export function markeLesen(wert: string | null | undefined): Marke | null {
  if (!wert) return null;
  const m = /^(\d{1,15})-([a-z0-9]{1,40})$/.exec(wert);
  if (!m) return null;
  const ms = Number(m[1]);
  if (!Number.isSafeInteger(ms) || ms > 8.64e15) return null;
  return { zeit: new Date(ms), id: m[2] };
}

/**
 * Stellt die Antwort zusammen. `zeilen` aelteste zuerst. Die Marke zeigt auf die letzte gelesene
 * Zeile (auch wenn sie kein Ereignis ergab); ohne neue Zeilen bleibt die bisherige Marke.
 */
export function baueAntwort(zeilen: AuditZeile[], bisher: Marke | null): { marke: string; ereignisse: Ereignis[] } {
  const letzte = zeilen[zeilen.length - 1];
  const marke = letzte
    ? markeBilden(letzte.zeitpunkt, letzte.id)
    : bisher ? markeBilden(bisher.zeit, bisher.id) : MARKE_ANFANG;
  const ereignisse = zeilen.map(ereignisAusAudit).filter((e): e is Ereignis => e !== null);
  return { marke, ereignisse };
}
