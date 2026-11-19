/**
 * "Anmeldung nur noch ueber das Portal" (PORTAL_ANMELDUNG_URL) – reine Auswertung der Einstellung,
 * ohne Zugriff auf Datenbank oder Sitzung (dadurch auch einzeln testbar).
 */

/** Mindestlaenge von PORTAL_SECRET, wie in src/lib/portal.ts. */
const SECRET_MIN = 32;

/**
 * Adresse des Portals ohne Schraegstrich am Ende, oder null, wenn die Anmeldung wie bisher laeuft.
 * Wirkt nur zusammen mit einem gueltigen PORTAL_SECRET und nur als gueltige https://-Adresse
 * (lokal auch http://localhost). Alles andere: null, das Programm verhaelt sich wie bisher.
 */
export function portalAnmeldungBasis(env: Record<string, string | undefined> = process.env): string | null {
  const secret = env.PORTAL_SECRET;
  if (!secret || secret.length < SECRET_MIN) return null;
  const roh = (env.PORTAL_ANMELDUNG_URL ?? '').trim();
  if (!roh) return null;
  let url: URL;
  try {
    url = new URL(roh);
  } catch {
    return null;
  }
  const lokal = url.protocol === 'http:' && url.hostname === 'localhost';
  if (url.protocol !== 'https:' && !lokal) return null;
  if (url.username || url.password) return null;
  return url.origin + url.pathname.replace(/\/+$/, '');
}

/** Ziel des Knopfes "Über das Portal anmelden": <PORTAL_ANMELDUNG_URL>/go/<programm-id>. */
export function portalAnmeldeLink(appId: string, env: Record<string, string | undefined> = process.env): string | null {
  const basis = portalAnmeldungBasis(env);
  return basis ? `${basis}/go/${appId}` : null;
}

export const NUR_PORTAL_HINWEIS =
  'Die Anmeldung läuft über das Wunsch-Pflege Portal. Bitte dort anmelden und die Warteliste über das Portal öffnen.';

export const NUR_PORTAL_PIN_HINWEIS =
  'Die Anmeldung läuft über das Wunsch-Pflege Portal. Eine eigene PIN für die Warteliste wird nicht mehr gebraucht und kann hier nicht geändert werden.';
