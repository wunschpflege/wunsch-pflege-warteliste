import type { Status, Prioritaet, Pflegegrad, Geschlecht, WiedervorlageTyp } from '@prisma/client';

export const STATUS_LABEL: Record<Status, string> = {
  NEUE_ANFRAGE: 'Neue Anfrage',
  WARTELISTE: 'Warteliste',
  BESICHTIGUNG_GEPLANT: 'Besichtigung geplant',
  AUFNAHME_IN_VORBEREITUNG: 'Aufnahme in Vorbereitung',
  PLATZ_ANGEBOTEN: 'Platz angeboten',
  EINGEZOGEN: 'Eingezogen',
  ABGELEHNT: 'Abgelehnt',
  ARCHIVIERT: 'Archiviert',
};

export const STATUS_COLOR: Record<Status, string> = {
  NEUE_ANFRAGE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  WARTELISTE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  BESICHTIGUNG_GEPLANT: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  AUFNAHME_IN_VORBEREITUNG: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200',
  PLATZ_ANGEBOTEN: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200',
  EINGEZOGEN: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  ABGELEHNT: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  ARCHIVIERT: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
};

export const PRIO_LABEL: Record<Prioritaet, string> = {
  NIEDRIG: 'Niedrig',
  NORMAL: 'Normal',
  HOCH: 'Hoch',
  DRINGEND: 'Dringend',
};

export const PFLEGEGRAD_LABEL: Record<Pflegegrad, string> = {
  KEINER: 'Kein Pflegegrad',
  PG1: 'Pflegegrad 1',
  PG2: 'Pflegegrad 2',
  PG3: 'Pflegegrad 3',
  PG4: 'Pflegegrad 4',
  PG5: 'Pflegegrad 5',
};

export const GESCHLECHT_LABEL: Record<Geschlecht, string> = {
  MAENNLICH: 'Männlich',
  WEIBLICH: 'Weiblich',
  DIVERS: 'Divers',
  EGAL: 'Egal',
};

export const WV_TYP_LABEL: Record<WiedervorlageTyp, string> = {
  RUECKRUF: 'Rückruf',
  WIEDERVORLAGE: 'Wiedervorlage',
  PLATZ_ERINNERUNG: 'Platz-Erinnerung',
  SONSTIGES: 'Sonstiges',
};

export function fmtDate(d?: Date | null): string {
  if (!d) return '–';
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(new Date(d));
}

export function fmtDateTime(d?: Date | null): string {
  if (!d) return '–';
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(d),
  );
}

export function fmtDateInput(d?: Date | null): string {
  if (!d) return '';
  return new Date(d).toISOString().slice(0, 10);
}
