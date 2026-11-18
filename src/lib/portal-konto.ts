import 'server-only';
import type { Role } from '@prisma/client';

/** Rollen in der Reihenfolge von wenig zu viel Rechten (IDs = Werte der Rolle in der Datenbank). */
export const PORTAL_ROLLEN: Role[] = ['VERWALTUNG', 'PDL', 'GESCHAEFTSFUEHRUNG'];

/** Rolle mit den wenigsten Rechten; auch der Standard der Datenbank fuer neue Konten. */
export const PORTAL_STANDARD_ROLLE: Role = 'VERWALTUNG';

export function istRolle(wert: unknown): wert is Role {
  return typeof wert === 'string' && (PORTAL_ROLLEN as string[]).includes(wert);
}

/**
 * Benutzername in der Schreibweise, die die Warteliste speichert (klein, ohne Leerzeichen am Rand).
 * Die Warteliste bildet ihre Benutzernamen selbst aus Kleinbuchstaben und Ziffern mit Punkt
 * (z. B. "p.muster"); ueber das Portal sind zusaetzlich "-" und "_" erlaubt.
 * Gibt null zurueck, wenn der Name die Regeln nicht erfuellt.
 */
export function portalBenutzername(wert: string): string | null {
  const name = wert.trim().toLowerCase();
  if (name.length < 3 || name.length > 50) return null;
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(name)) return null;
  return name;
}

export const BENUTZERNAME_REGEL =
  'Benutzername ungültig: 3 bis 50 Zeichen, nur Kleinbuchstaben a–z (keine Umlaute), Ziffern sowie Punkt, Bindestrich oder Unterstrich dazwischen (z. B. p.muster).';
