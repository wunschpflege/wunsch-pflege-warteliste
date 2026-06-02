import 'server-only';
import { prisma } from './prisma';
import type { SessionUser } from './auth';
import {
  STATUS_LABEL, PRIO_LABEL, PFLEGEGRAD_LABEL,
} from './labels';

/** Technischer Audit-Trail (DSGVO-Nachvollziehbarkeit). */
export async function audit(
  user: Pick<SessionUser, 'id' | 'kuerzel'> | null,
  aktion: string,
  entitaet: string,
  entitaetId?: string,
  details?: string,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: user?.id ?? null,
        kuerzel: user?.kuerzel ?? null,
        aktion,
        entitaet,
        entitaetId,
        details,
      },
    });
  } catch {
    // Audit darf den Hauptvorgang niemals blockieren
  }
}

/** Fachliche Historie eines Interessenten-Datensatzes. */
export async function logHistorie(
  interessentId: string,
  user: Pick<SessionUser, 'kuerzel' | 'vorname' | 'nachname'>,
  aktion: string,
  feld?: string,
  altWert?: string | null,
  neuWert?: string | null,
): Promise<void> {
  await prisma.historie.create({
    data: {
      interessentId,
      kuerzel: user.kuerzel,
      mitarbeiter: `${user.vorname} ${user.nachname}`,
      aktion,
      feld,
      altWert: altWert ?? null,
      neuWert: neuWert ?? null,
    },
  });
}

// Menschenlesbare Feldnamen fuer die Historie
const FELD_LABEL: Record<string, string> = {
  vorname: 'Vorname', nachname: 'Nachname', geburtsdatum: 'Geburtsdatum',
  pflegegrad: 'Pflegegrad', krankenkasse: 'Krankenkasse', wohnsituation: 'Wohnsituation',
  gewuenschterEinzug: 'Gewünschter Einzug', diagnosen: 'Diagnosen', mobilitaet: 'Mobilität',
  besonderheiten: 'Besonderheiten', bemerkungen: 'Bemerkungen',
  angehoerigerVorname: 'Angehöriger Vorname', angehoerigerNachname: 'Angehöriger Nachname',
  angehoerigerBeziehung: 'Beziehung', angStrasse: 'Straße', angHausnummer: 'Hausnummer',
  angPlz: 'PLZ', angOrt: 'Ort', telefonFestnetz: 'Telefon Festnetz',
  telefonMobil: 'Telefon Mobil', email: 'E-Mail', status: 'Status',
  prioritaet: 'Priorität', standortId: 'Standort',
};

function readable(feld: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '–';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (feld === 'status') return STATUS_LABEL[value as keyof typeof STATUS_LABEL] ?? String(value);
  if (feld === 'prioritaet') return PRIO_LABEL[value as keyof typeof PRIO_LABEL] ?? String(value);
  if (feld === 'pflegegrad') return PFLEGEGRAD_LABEL[value as keyof typeof PFLEGEGRAD_LABEL] ?? String(value);
  return String(value);
}

/**
 * Vergleicht alten und neuen Datensatz und schreibt fuer jedes
 * geaenderte Feld einen Historieneintrag.
 */
export async function diffAndLog(
  interessentId: string,
  user: Pick<SessionUser, 'kuerzel' | 'vorname' | 'nachname'>,
  vorher: Record<string, unknown>,
  nachher: Record<string, unknown>,
  standortNameAlt?: string,
  standortNameNeu?: string,
): Promise<void> {
  for (const feld of Object.keys(nachher)) {
    const a = vorher[feld];
    const b = nachher[feld];
    const aNorm = a instanceof Date ? a.toISOString().slice(0, 10) : a ?? '';
    const bNorm = b instanceof Date ? b.toISOString().slice(0, 10) : b ?? '';
    if (String(aNorm) === String(bNorm)) continue;

    let altText = readable(feld, a);
    let neuText = readable(feld, b);
    if (feld === 'standortId') {
      altText = standortNameAlt ?? '–';
      neuText = standortNameNeu ?? '–';
    }
    const label = FELD_LABEL[feld] ?? feld;
    await logHistorie(
      interessentId,
      user,
      feld === 'status' ? `Status auf „${neuText}“ geändert` : `${label} geändert`,
      label,
      altText,
      neuText,
    );
  }
}
