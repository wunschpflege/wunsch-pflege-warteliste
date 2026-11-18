import 'server-only';
import { createHash, timingSafeEqual } from 'crypto';

/** App-ID dieses Programms im Wunsch-Pflege Portal. */
export const PORTAL_APP_ID = 'warteliste';
export const PORTAL_ISSUER = 'wunschpflege-portal';

/**
 * Gemeinsames Geheimnis zwischen Portal und diesem Programm.
 * Fehlt es oder ist es kuerzer als 32 Zeichen, ist die Anbindung aus (null).
 */
export function portalSecret(): string | null {
  const s = process.env.PORTAL_SECRET;
  return s && s.length >= 32 ? s : null;
}

/** Vergleich in konstanter Zeit (ueber SHA-256, damit auch die Laenge nicht durchsickert). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

// ─── Einmal-Token (jti) ──────────────────────────────────────────────────────
// Benutzte jti werden bis zu ihrem Ablauf im Arbeitsspeicher gemerkt.
const g = globalThis as unknown as { __portalJti?: Map<string, number> };
const benutzteJti: Map<string, number> = g.__portalJti ?? (g.__portalJti = new Map());

/** Merkt die jti als benutzt. Gibt false zurueck, wenn sie schon einmal benutzt wurde. */
export function jtiEinloesen(jti: string, expSekunden: number): boolean {
  const now = Date.now();
  for (const [id, ablauf] of benutzteJti) {
    if (ablauf <= now) benutzteJti.delete(id);
  }
  if (benutzteJti.has(jti)) return false;
  benutzteJti.set(jti, expSekunden * 1000);
  return true;
}

/**
 * Sprungziel nach der Portal-Anmeldung: nur Pfade innerhalb dieses Programms.
 * Genau ein "/" am Anfang, kein "//", kein Rueckwaertsstrich, keine Steuerzeichen. Sonst "/".
 */
export function sicheresZiel(ziel: string | null): string {
  if (!ziel || !ziel.startsWith('/') || ziel.startsWith('//')) return '/';
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(ziel)) return '/';
  return ziel;
}
