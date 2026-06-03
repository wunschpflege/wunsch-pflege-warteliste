import { z } from 'zod';

const optStr = z.string().trim().optional().transform((v) => (v ? v : null));
const optDate = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(v) : null))
  .refine((d) => d === null || !isNaN(d.getTime()), 'Ungültiges Datum');

export const interessentSchema = z.object({
  vorname: z.string().trim().min(1, 'Vorname ist erforderlich'),
  nachname: z.string().trim().min(1, 'Nachname ist erforderlich'),
  geburtsdatum: optDate,
  pflegegrad: z.enum(['KEINER', 'PG1', 'PG2', 'PG3', 'PG4', 'PG5']).default('KEINER'),
  krankenkasse: optStr,
  wohnsituation: optStr,
  gewuenschterEinzug: optDate,
  diagnosen: optStr,
  mobilitaet: optStr,
  besonderheiten: optStr,
  bemerkungen: optStr,
  angehoerigerVorname: optStr,
  angehoerigerNachname: optStr,
  angehoerigerBeziehung: optStr,
  angStrasse: optStr,
  angHausnummer: optStr,
  angPlz: optStr,
  angOrt: optStr,
  telefonFestnetz: optStr,
  telefonMobil: optStr,
  email: z.string().trim().email('Ungültige E-Mail').optional().or(z.literal('')).transform((v) => (v ? v : null)),
  status: z.enum([
    'NEUE_ANFRAGE', 'WARTELISTE', 'BESICHTIGUNG_GEPLANT', 'AUFNAHME_IN_VORBEREITUNG',
    'PLATZ_ANGEBOTEN', 'EINGEZOGEN', 'ABGELEHNT', 'ARCHIVIERT',
  ]).default('NEUE_ANFRAGE'),
  prioritaet: z.enum(['NIEDRIG', 'NORMAL', 'HOCH', 'DRINGEND']).default('NORMAL'),
  standortId: z.string().optional().transform((v) => (v ? v : null)),
});

export const userSchema = z.object({
  vorname: z.string().trim().min(1, 'Vorname erforderlich'),
  nachname: z.string().trim().min(1, 'Nachname erforderlich'),
  role: z.enum(['GESCHAEFTSFUEHRUNG', 'PDL', 'VERWALTUNG']),
  pin: z.string().regex(/^\d{4}$/, 'PIN muss genau 4 Ziffern sein').optional().or(z.literal('')),
});

export const standortSchema = z.object({
  name: z.string().trim().min(1, 'Name erforderlich'),
  strasse: optStr,
  hausnummer: optStr,
  plz: optStr,
  ort: optStr,
  bemerkungen: optStr,
  aktiv: z.coerce.boolean().default(true),
});

export const platzSchema = z.object({
  standortId: z.string().min(1, 'Standort erforderlich'),
  zimmernummer: z.string().trim().min(1, 'Zimmernummer erforderlich'),
  freiAb: optDate,
  geschlechtPref: z.enum(['MAENNLICH', 'WEIBLICH', 'DIVERS', 'EGAL']).default('EGAL'),
  belegt: z.coerce.boolean().default(false),
  bemerkungen: optStr,
});

export const wiedervorlageSchema = z.object({
  typ: z.enum(['RUECKRUF', 'WIEDERVORLAGE', 'PLATZ_ERINNERUNG', 'SONSTIGES']).default('WIEDERVORLAGE'),
  titel: z.string().trim().min(1, 'Titel erforderlich'),
  notiz: optStr,
  faelligAm: z.string().min(1, 'Datum erforderlich').transform((v) => new Date(v)),
  interessentId: z.string().optional().transform((v) => (v ? v : null)),
});

/** Wandelt FormData in ein flaches Objekt um. */
export function formToObject(fd: FormData): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === 'string') o[k] = v;
  }
  return o;
}
