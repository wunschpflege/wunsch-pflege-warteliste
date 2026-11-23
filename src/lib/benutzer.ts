import 'server-only';
import type { Prisma, Role, User } from '@prisma/client';
import { prisma } from './prisma';
import { audit } from './audit';
import { buildInitials } from './initials';
import { portalKontoTreffer, type SessionUser } from './auth';
import { ROLE_LABEL } from './rbac';
import { PORTAL_VERMERK, ROLLE_GEAENDERT } from './portal-aktivitaet';

/** Eindeutiges Kuerzel erzeugen (bei Kollision Ziffer anhaengen). */
export async function uniqueKuerzel(vorname: string, nachname: string, ignoreId?: string): Promise<string> {
  const base = buildInitials(vorname, nachname);
  let candidate = base;
  let n = 1;
  while (true) {
    const found = await prisma.user.findFirst({ where: { kuerzel: candidate, NOT: ignoreId ? { id: ignoreId } : undefined } });
    if (!found) return candidate;
    n += 1;
    candidate = `${base}${n}`;
  }
}

/**
 * Legt ein Benutzerkonto an und schreibt den Audit-Eintrag. Gemeinsamer Weg fuer die
 * Benutzerverwaltung und das Anlegen ueber das Portal.
 * `actor` ist null, wenn niemand angemeldet ist (Portal); `vermerk` wird an den Audit-Text angehaengt.
 */
export async function benutzerAnlegen(
  daten: { vorname: string; nachname: string; role: Role; username: string; passwordHash: string; kuerzel?: string },
  actor: Pick<SessionUser, 'id' | 'kuerzel'> | null,
  vermerk?: string,
): Promise<User> {
  const { vorname, nachname, role, username, passwordHash } = daten;
  const kuerzel = daten.kuerzel ?? (await uniqueKuerzel(vorname, nachname));
  const created = await prisma.user.create({
    data: { vorname, nachname, role, kuerzel, username, passwordHash },
  });
  await audit(
    actor, 'CREATE', 'User', created.id,
    `${vorname} ${nachname} (${kuerzel}) → ${username}${vermerk ? ` – ${vermerk}` : ''}`,
  );
  return created;
}

type Akteur = Pick<SessionUser, 'id' | 'kuerzel'> | null;

/** Rolle mit vollen Verwaltungsrechten; von ihr muss immer mindestens ein aktives Konto bleiben. */
const VOLLE_RECHTE: Role = 'GESCHAEFTSFUEHRUNG';

/**
 * true, wenn das Konto mit der neuen Rolle das letzte aktive Konto der Geschaeftsfuehrung verloere
 * (danach kaeme niemand mehr in die Benutzerverwaltung). Gilt fuer die Benutzerverwaltung und das Portal.
 */
export async function waereLetzteVerwaltungWeg(
  u: Pick<User, 'id' | 'role' | 'aktiv'>,
  neueRolle: Role,
  db: Prisma.TransactionClient = prisma,
): Promise<boolean> {
  if (!u.aktiv || u.role !== VOLLE_RECHTE || neueRolle === VOLLE_RECHTE) return false;
  const andere = await db.user.count({ where: { role: VOLLE_RECHTE, aktiv: true, NOT: { id: u.id } } });
  return andere === 0;
}

export const LETZTE_VERWALTUNG_ROLLE =
  'Rolle nicht geändert: Das ist das letzte aktive Konto der Geschäftsführung in der Warteliste. Bitte zuerst ein anderes Konto mit dieser Rolle einrichten.';

async function aktivSchreiben(db: Prisma.TransactionClient, id: string, aktiv: boolean): Promise<void> {
  await db.user.update({ where: { id }, data: { aktiv } });
}

async function aktivProtokollieren(actor: Akteur, id: string, aktiv: boolean, vermerk?: string): Promise<void> {
  await audit(actor, 'UPDATE', 'User', id, `${aktiv ? 'aktiviert' : 'deaktiviert'}${vermerk ? ` – ${vermerk}` : ''}`);
}

/**
 * Aktiviert oder deaktiviert ein Konto und schreibt den Audit-Eintrag. Ein deaktiviertes Konto
 * kann sich nicht mehr anmelden, und bestehende Sitzungen enden mit der naechsten Anfrage
 * (getSession prueft das Konto jedes Mal in der Datenbank).
 */
export async function benutzerAktivSetzen(id: string, aktiv: boolean, actor: Akteur, vermerk?: string): Promise<void> {
  await aktivSchreiben(prisma, id, aktiv);
  await aktivProtokollieren(actor, id, aktiv, vermerk);
}

export type PortalSperrErgebnis =
  | { status: 'unbekannt' }
  | { status: 'gesperrt'; vorherAktiv: boolean }
  | { status: 'letzte_verwaltung' }
  | { status: 'mehrdeutig' };

/**
 * Sperrt (deaktiviert) das Konto zu einem Anmeldenamen des Portals, so wie es die Benutzerverwaltung
 * beim Deaktivieren tut. Beliebig oft wiederholbar; entsperrt wird hier nie.
 * Das letzte aktive Konto der Geschaeftsfuehrung wird nicht gesperrt (sonst kaeme niemand mehr in
 * die Benutzerverwaltung). Pruefung und Sperre laufen in einer Transaktion, damit zwei gleichzeitige
 * Aufrufe nicht zusammen die letzten beiden Konten sperren.
 */
export async function portalKontoSperren(anmeldename: string): Promise<PortalSperrErgebnis> {
  for (let versuch = 1; ; versuch += 1) {
    try {
      let gesperrtId: string | null = null;
      const ergebnis = await prisma.$transaction(async (tx): Promise<PortalSperrErgebnis> => {
        const treffer = await portalKontoTreffer(anmeldename, tx);
        if (treffer.length === 0) return { status: 'unbekannt' };
        const aktive = treffer.filter((u) => u.aktiv);
        if (aktive.length === 0) return { status: 'gesperrt', vorherAktiv: false };
        // Mehrere aktive Konten, die sich nur in Gross-/Kleinschreibung unterscheiden: nicht raten
        if (aktive.length > 1) return { status: 'mehrdeutig' };
        const u = aktive[0];
        if (u.role === VOLLE_RECHTE) {
          const andere = await tx.user.count({ where: { role: VOLLE_RECHTE, aktiv: true, NOT: { id: u.id } } });
          if (andere === 0) return { status: 'letzte_verwaltung' };
        }
        await aktivSchreiben(tx, u.id, false);
        gesperrtId = u.id;
        return { status: 'gesperrt', vorherAktiv: true };
      }, { isolationLevel: 'Serializable' });
      if (gesperrtId) await aktivProtokollieren(null, gesperrtId, false, PORTAL_VERMERK);
      return ergebnis;
    } catch (e) {
      // P2034: zwei Vorgaenge kamen sich in die Quere – noch einmal versuchen
      if ((e as { code?: string })?.code === 'P2034' && versuch < 3) continue;
      throw e;
    }
  }
}

export type PortalEntsperrErgebnis =
  | { status: 'unbekannt' }
  | { status: 'aktiv'; vorherAktiv: boolean }
  | { status: 'mehrdeutig' };

/**
 * Entsperrt (aktiviert) das Konto zu einem Anmeldenamen des Portals, auf demselben Weg wie
 * "Aktivieren" in der Benutzerverwaltung (benutzerAktivSetzen). Die PIN bleibt, wie sie ist, es
 * entsteht keine Sitzung. Beliebig oft wiederholbar.
 */
export async function portalKontoEntsperren(anmeldename: string): Promise<PortalEntsperrErgebnis> {
  const treffer = await portalKontoTreffer(anmeldename);
  if (treffer.length === 0) return { status: 'unbekannt' };
  if (treffer.some((u) => u.aktiv)) return { status: 'aktiv', vorherAktiv: true };
  // Mehrere gesperrte Konten, die sich nur in Gross-/Kleinschreibung unterscheiden: nicht raten
  if (treffer.length > 1) return { status: 'mehrdeutig' };
  await benutzerAktivSetzen(treffer[0].id, true, null, PORTAL_VERMERK);
  return { status: 'aktiv', vorherAktiv: false };
}

export type PortalRollenErgebnis =
  | { status: 'unbekannt' }
  | { status: 'geaendert'; rolle: Role; vorher: Role }
  | { status: 'letzte_verwaltung' }
  | { status: 'mehrdeutig' };

/**
 * Aendert die Rolle des Kontos zu einem Anmeldenamen des Portals. Geschrieben wird nur die Rolle –
 * Benutzername, Name, Kuerzel und PIN bleiben unveraendert. Gleicher Schutz wie in der
 * Benutzerverwaltung: Das letzte aktive Konto der Geschaeftsfuehrung behaelt seine Rolle.
 * Die neue Rolle gilt sofort (jede Anfrage liest die Rolle aus der Datenbank).
 * Der Audit-Eintrag nennt nur alte und neue Rolle, keinen Namen.
 */
export async function portalRolleAendern(anmeldename: string, rolle: Role): Promise<PortalRollenErgebnis> {
  for (let versuch = 1; ; versuch += 1) {
    try {
      let geaendert: { id: string; vorher: Role } | null = null;
      const ergebnis = await prisma.$transaction(async (tx): Promise<PortalRollenErgebnis> => {
        const treffer = await portalKontoTreffer(anmeldename, tx);
        if (treffer.length === 0) return { status: 'unbekannt' };
        const aktive = treffer.filter((u) => u.aktiv);
        // Genau ein aktives Konto, sonst genau ein (gesperrtes) Konto; alles andere waere geraten
        const u = aktive.length === 1 ? aktive[0] : aktive.length === 0 && treffer.length === 1 ? treffer[0] : null;
        if (!u) return { status: 'mehrdeutig' };
        if (u.role === rolle) return { status: 'geaendert', rolle, vorher: u.role };
        if (await waereLetzteVerwaltungWeg(u, rolle, tx)) return { status: 'letzte_verwaltung' };
        await tx.user.update({ where: { id: u.id }, data: { role: rolle } });
        geaendert = { id: u.id, vorher: u.role };
        return { status: 'geaendert', rolle, vorher: u.role };
      }, { isolationLevel: 'Serializable' });
      if (geaendert) {
        const { id, vorher } = geaendert as { id: string; vorher: Role };
        await audit(null, 'UPDATE', 'User', id, `${ROLLE_GEAENDERT}${ROLE_LABEL[vorher]} → ${ROLE_LABEL[rolle]} – ${PORTAL_VERMERK}`);
      }
      return ergebnis;
    } catch (e) {
      // P2034: zwei Vorgaenge kamen sich in die Quere – noch einmal versuchen
      if ((e as { code?: string })?.code === 'P2034' && versuch < 3) continue;
      throw e;
    }
  }
}
