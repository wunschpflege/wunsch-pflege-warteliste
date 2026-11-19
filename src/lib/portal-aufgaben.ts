/**
 * Aufgabenliste fuer das Wunsch-Pflege Portal (GET /api/portal/aufgaben).
 * Reine Aufbereitung ohne Datenbankzugriff (dadurch einzeln testbar).
 *
 * Datenschutz: In `titel` und `detail` stehen ausschliesslich Art der Aufgabe, Anzahl, Datum und
 * Standortname. Die Eingangsdaten enthalten deshalb bewusst gar keine Namen, keine Freitexte
 * (Titel/Notiz einer Wiedervorlage nennen oft die Person) und keine Gesundheitsangaben –
 * was hier nicht hereinkommt, kann auch nicht hinausgehen.
 */

export type AufgabenStatus = 'kritisch' | 'warnung' | 'info';

export interface Aufgabe {
  id: string;
  titel: string;
  detail?: string;
  status: AufgabenStatus;
  faellig?: string;
  pfad: string;
}

export type WvTyp = 'RUECKRUF' | 'WIEDERVORLAGE' | 'PLATZ_ERINNERUNG' | 'SONSTIGES';

/** Einzelne Punkte (hoechstens EINZELN_MAX, die aeltesten zuerst) plus Gesamtzahl der Kategorie. */
export interface Einzelpunkte<T> { punkte: T[]; anzahl: number }

/** Jede Quelle fehlt (undefined), wenn das Konto sie nicht sehen darf oder die Abfrage fehlschlug. */
export interface AufgabenDaten {
  wvUeberfaellig?: Einzelpunkte<{ id: string; typ: WvTyp; faelligAm: Date }>;
  wvFaellig?: Einzelpunkte<{ id: string; typ: WvTyp; faelligAm: Date }>;
  rueckmeldungen?: Einzelpunkte<{ id: string; rueckmeldungBis: Date }>;
  neueAnfragen?: { anzahl: number; aelteste: Date | null };
  langeWartezeit?: { anzahl: number; grenze: Date };
  freiePlaetze?: { name: string; frei: number }[];
}

export const AUFGABEN_MAX = 50;
/** So viele Punkte je Kategorie werden einzeln genannt; der Rest wird mit Anzahl zusammengefasst. */
export const EINZELN_MAX = 15;
export const TITEL_MAX = 100;
export const DETAIL_MAX = 120;

const TAG_MS = 86_400_000;
const berlinDatum = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Kalendertag in deutscher Zeit als JJJJ-MM-TT. */
export function datumIso(d: Date): string {
  return berlinDatum.format(d);
}

function datumDe(d: Date): string {
  const [j, m, t] = datumIso(d).split('-');
  return `${t}.${m}.${j}`;
}

/** Ganze Kalendertage (deutsche Zeit) von `von` bis `bis`; negativ, wenn `bis` davor liegt. */
export function tageZwischen(von: Date, bis: Date): number {
  return Math.round((Date.parse(datumIso(bis)) - Date.parse(datumIso(von))) / TAG_MS);
}

export function kuerzen(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + '…';
}

function ueberfaelligText(faellig: Date, jetzt: Date): string {
  const tage = tageZwischen(faellig, jetzt);
  if (tage <= 0) return 'seit heute überfällig';
  return tage === 1 ? 'seit gestern überfällig' : `seit ${tage} Tagen überfällig`;
}

function faelligText(faellig: Date, jetzt: Date): string {
  const tage = tageZwischen(jetzt, faellig);
  if (tage <= 0) return 'heute fällig';
  return tage === 1 ? 'morgen fällig' : `in ${tage} Tagen fällig`;
}

// Nur die Art der Erinnerung – der frei eingegebene Titel bleibt im Programm.
const WV_ART: Record<WvTyp, string> = {
  RUECKRUF: 'Rückruf',
  WIEDERVORLAGE: 'Wiedervorlage',
  PLATZ_ERINNERUNG: 'Platz-Erinnerung',
  SONSTIGES: 'Erinnerung',
};

const RANG: Record<AufgabenStatus, number> = { kritisch: 0, warnung: 1, info: 2 };

/** Dringendste zuerst: kritisch vor warnung vor info, darin nach `faellig` aufsteigend (ohne Datum zuletzt). */
export function sortiereAufgaben(aufgaben: Aufgabe[]): Aufgabe[] {
  return [...aufgaben].sort(
    (a, b) =>
      RANG[a.status] - RANG[b.status] ||
      (a.faellig ?? '9999-99-99').localeCompare(b.faellig ?? '9999-99-99') ||
      a.id.localeCompare(b.id),
  );
}

export function baueAufgaben(daten: AufgabenDaten, jetzt: Date): Aufgabe[] {
  const liste: Aufgabe[] = [];

  // Wiedervorlagen ueberfaellig (Kennzahl wiedervorlagen_ueberfaellig, kritisch)
  if (daten.wvUeberfaellig) {
    const { punkte, anzahl } = daten.wvUeberfaellig;
    for (const w of punkte) {
      liste.push({
        id: `wv-${w.id}`, titel: `${WV_ART[w.typ]} überfällig`, detail: ueberfaelligText(w.faelligAm, jetzt),
        status: 'kritisch', faellig: datumIso(w.faelligAm), pfad: '/wiedervorlagen',
      });
    }
    const rest = anzahl - punkte.length;
    if (rest > 0) {
      liste.push({
        id: 'wv-ueberfaellig-weitere', status: 'kritisch', pfad: '/wiedervorlagen',
        titel: rest === 1 ? '1 weitere Wiedervorlage überfällig' : `${rest} weitere Wiedervorlagen überfällig`,
      });
    }
  }

  // Rueckmeldungen zu einem Platzangebot ueberfaellig (Kennzahl rueckmeldungen_ueberfaellig, kritisch)
  if (daten.rueckmeldungen) {
    const { punkte, anzahl } = daten.rueckmeldungen;
    for (const r of punkte) {
      liste.push({
        id: `rueckmeldung-${r.id}`, titel: 'Rückmeldung zum Platzangebot überfällig',
        detail: ueberfaelligText(r.rueckmeldungBis, jetzt),
        status: 'kritisch', faellig: datumIso(r.rueckmeldungBis), pfad: `/warteliste/${r.id}`,
      });
    }
    const rest = anzahl - punkte.length;
    if (rest > 0) {
      liste.push({
        id: 'rueckmeldung-weitere', status: 'kritisch', pfad: '/warteliste',
        titel: rest === 1 ? '1 weitere Rückmeldung überfällig' : `${rest} weitere Rückmeldungen überfällig`,
      });
    }
  }

  // Wiedervorlagen in den naechsten 7 Tagen (Kennzahl wiedervorlagen_faellig, warnung)
  if (daten.wvFaellig) {
    const { punkte, anzahl } = daten.wvFaellig;
    for (const w of punkte) {
      liste.push({
        id: `wv-${w.id}`, titel: `${WV_ART[w.typ]} fällig`, detail: faelligText(w.faelligAm, jetzt),
        status: 'warnung', faellig: datumIso(w.faelligAm), pfad: '/wiedervorlagen',
      });
    }
    const rest = anzahl - punkte.length;
    if (rest > 0) {
      liste.push({
        id: 'wv-faellig-weitere', status: 'warnung', pfad: '/wiedervorlagen',
        titel: rest === 1 ? '1 weitere Wiedervorlage in 7 Tagen fällig' : `${rest} weitere Wiedervorlagen in 7 Tagen fällig`,
      });
    }
  }

  // Neue Anfragen (Kennzahl neue_anfragen, warnung) – zusammengefasst mit Anzahl
  if (daten.neueAnfragen && daten.neueAnfragen.anzahl > 0) {
    const { anzahl, aelteste } = daten.neueAnfragen;
    liste.push({
      id: 'neue-anfragen', status: 'warnung', pfad: '/warteliste?status=NEUE_ANFRAGE',
      titel: anzahl === 1 ? '1 neue Anfrage unbearbeitet' : `${anzahl} neue Anfragen unbearbeitet`,
      ...(aelteste ? { detail: anzahl === 1 ? `eingegangen am ${datumDe(aelteste)}` : `älteste vom ${datumDe(aelteste)}` } : {}),
    });
  }

  // Wartezeit ueber 3 Monate (Kennzahl lange_wartezeit, warnung) – zusammengefasst mit Anzahl
  if (daten.langeWartezeit && daten.langeWartezeit.anzahl > 0) {
    const { anzahl, grenze } = daten.langeWartezeit;
    liste.push({
      id: 'lange-wartezeit', status: 'warnung', pfad: `/warteliste?bis=${datumIso(grenze)}`,
      titel: anzahl === 1 ? '1 Anfrage wartet länger als 3 Monate' : `${anzahl} Anfragen warten länger als 3 Monate`,
      detail: `eingetragen vor dem ${datumDe(grenze)}`,
    });
  }

  // Freie Plaetze (Kennzahl freie_plaetze, info) – ein Eintrag, Standorte im Detail
  if (daten.freiePlaetze) {
    const frei = daten.freiePlaetze.filter((s) => s.frei > 0);
    const summe = frei.reduce((n, s) => n + s.frei, 0);
    if (summe > 0) {
      liste.push({
        id: 'freie-plaetze', status: 'info', pfad: '/plaetze',
        titel: summe === 1 ? '1 freier Platz' : `${summe} freie Plätze`,
        detail: frei.map((s) => `${s.name}: ${s.frei}`).join(', '),
      });
    }
  }

  return sortiereAufgaben(liste)
    .slice(0, AUFGABEN_MAX)
    .map((a) => ({
      ...a,
      titel: kuerzen(a.titel, TITEL_MAX),
      ...(a.detail ? { detail: kuerzen(a.detail, DETAIL_MAX) } : {}),
    }));
}
