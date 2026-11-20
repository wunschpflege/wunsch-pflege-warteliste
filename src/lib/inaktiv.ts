// Automatische Abmeldung nach Inaktivitaet: Einstellung und Rechenregeln.
// Bewusst ohne Datenbank und ohne Next.js, damit Server, Browser und Tests dieselben Regeln benutzen.

export const INAKTIV_STANDARD_MINUTEN = 15;
const MIN_MINUTEN = 0.1;
const MAX_MINUTEN = 240;

/** Kopf, mit dem die Oberflaeche Anfragen kennzeichnet, die sie von selbst schickt (keine Eingabe der Person). */
export const HINTERGRUND_KOPF = 'x-hintergrund';

/**
 * Dauer bis zur automatischen Abmeldung in Minuten (Umgebungsvariable INAKTIV_MINUTEN).
 * Erlaubt sind 0.1 bis 240, auch mit Komma; alles andere ergibt den Standard von 15 Minuten.
 */
export function inaktivMinuten(env: Record<string, string | undefined> = process.env): number {
  const roh = (env.INAKTIV_MINUTEN ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(roh)) return INAKTIV_STANDARD_MINUTEN;
  const n = Number(roh);
  if (!Number.isFinite(n) || n < MIN_MINUTEN || n > MAX_MINUTEN) return INAKTIV_STANDARD_MINUTEN;
  return n;
}

export function inaktivMs(env: Record<string, string | undefined> = process.env): number {
  return Math.round(inaktivMinuten(env) * 60_000);
}

/** Die letzte Aktivitaet wird hoechstens so oft in die Datenbank geschrieben (30 s; bei Testdauern kuerzer). */
export function schreibDrosselMs(dauerMs: number): number {
  return Math.min(30_000, Math.floor(dauerMs / 10));
}

/** So lange vor dem Ablauf erscheint der Hinweis: 60 Sekunden, bei sehr kurzer Dauer die Haelfte. */
export function warnVorlaufMs(dauerMs: number): number {
  return Math.min(60_000, Math.floor(dauerMs / 2));
}

/** Eingaben ohne normale Anfrage meldet der Browser hoechstens so oft (1 Minute; bei Testdauern kuerzer). */
export function meldeAbstandMs(dauerMs: number): number {
  return Math.min(60_000, Math.floor(dauerMs / 4));
}

/** Ist die Sitzung wegen Inaktivitaet abgelaufen? */
export function istAbgelaufen(letzteAktivitaet: number, jetzt: number, dauerMs: number): boolean {
  return jetzt - letzteAktivitaet > dauerMs;
}

/**
 * Schickt die Oberflaeche die Anfrage von selbst (keine Eingabe der Person)? Dann verlaengert sie die
 * Sitzung nicht: eigene Hintergrund-Abfragen (X-Hintergrund: 1) und Vorausladen durch den Browser.
 *
 * Das Vorausladen verlinkter Seiten durch Next.js (<Link>) braucht hier keine Regel: Bei diesen
 * Anfragen werden Layout und Seite nicht ausgefuehrt, die Sitzung wird also gar nicht angefasst
 * (im Browser nachgeprueft). Next.js entfernt seinen Kopf "Next-Router-Prefetch", bevor der Code ihn
 * sehen koennte – sollte spaeter eine loading.tsx mit Sitzungspruefung dazukommen, erneut pruefen.
 */
export function istHintergrundAnfrage(kopf: { get(name: string): string | null }): boolean {
  if (kopf.get(HINTERGRUND_KOPF) === '1') return true;
  const zweck = (kopf.get('purpose') ?? kopf.get('sec-purpose') ?? '').toLowerCase();
  return zweck.includes('prefetch');
}

/** Minuten fuer Hinweistexte: "15", "1,5". */
export function minutenText(minuten: number): string {
  return String(Math.round(minuten * 10) / 10).replace('.', ',');
}

/** Hinweis auf der Anmeldeseite nach der automatischen Abmeldung. */
export function abgemeldetHinweis(minuten: number): string {
  const einheit = minuten === 1 ? 'Minute' : 'Minuten';
  return `Du wurdest nach ${minutenText(minuten)} ${einheit} ohne Eingabe automatisch abgemeldet.`;
}
