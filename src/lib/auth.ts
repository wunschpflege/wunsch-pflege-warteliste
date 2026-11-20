import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { audit } from './audit';
import { inaktivMs, istAbgelaufen, istHintergrundAnfrage, schreibDrosselMs } from './inaktiv';
import type { Prisma, Role, User } from '@prisma/client';

const COOKIE = 'wp_session';
const TTL_HOURS = Number(process.env.SESSION_TTL_HOURS ?? '8');

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error('AUTH_SECRET ist nicht oder zu kurz gesetzt (min. 16 Zeichen).');
  }
  return new TextEncoder().encode(s);
}

export interface SessionUser {
  id: string;
  username: string;
  vorname: string;
  nachname: string;
  kuerzel: string;
  role: Role;
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 12);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

/**
 * Legt eine Sitzung in der Datenbank an, erzeugt das signierte JWT (mit der Sitzungs-ID `sid`)
 * und setzt das Session-Cookie.
 */
export async function createSession(user: SessionUser): Promise<void> {
  // Alte Sitzungen aufraeumen (laenger als die Cookie-Laufzeit kann keine gelten)
  const alt = new Date(Date.now() - Math.max(TTL_HOURS, 24) * 2 * 3600_000);
  await prisma.sitzung.deleteMany({ where: { createdAt: { lt: alt } } }).catch(() => {});
  const sitzung = await prisma.sitzung.create({ data: { userId: user.id } });

  const token = await new SignJWT({ ...user, sid: sitzung.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TTL_HOURS}h`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_HOURS * 3600,
  });
}

/** Beendet die Sitzung in der Datenbank (das Cookie ist danach wertlos) und loescht das Cookie. */
export async function destroySession(grund: 'abmeldung' | 'inaktiv' = 'abmeldung'): Promise<void> {
  const store = await cookies();
  const sid = await sitzungsIdAusCookie();
  if (sid) {
    await prisma.sitzung
      .updateMany({ where: { id: sid, beendetAm: null }, data: { beendetAm: new Date(), beendetGrund: grund } })
      .catch(() => {});
  }
  store.delete(COOKIE);
}

async function sitzungsIdAusCookie(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sid === 'string' && payload.sid ? payload.sid : null;
  } catch {
    return null;
  }
}

/** Ergebnis der Sitzungspruefung. `grund: 'inaktiv'` = automatisch abgemeldet (zu lange keine Eingabe). */
export type SitzungsStatus =
  | { user: SessionUser; grund: null }
  | { user: null; grund: 'inaktiv' | 'keine' };

const KEINE: SitzungsStatus = { user: null, grund: 'keine' };
const INAKTIV: SitzungsStatus = { user: null, grund: 'inaktiv' };

/**
 * Prueft die Sitzung der laufenden Anfrage und fuehrt die letzte Aktivitaet.
 *
 * Das Cookie allein reicht nicht: Bei jeder Anfrage wird in der Datenbank nachgesehen, ob es das
 * Konto noch gibt und ob es aktiv ist. So wirkt eine Sperre (Benutzerverwaltung oder Portal) sofort
 * und nicht erst, wenn das Cookie ablaeuft. Name, Kuerzel und Rolle kommen aus der Datenbank,
 * nicht aus dem Cookie; eine geaenderte Rolle gilt damit ebenfalls sofort.
 *
 * Automatische Abmeldung: Liegt die letzte Aktivitaet der Sitzung laenger zurueck als INAKTIV_MINUTEN,
 * wird die Sitzung beendet und bleibt es – auch fuer spaetere Anfragen mit demselben Cookie.
 * Als Aktivitaet zaehlt jede Anfrage (Seitenaufruf, Server-Action, API), ausser die Oberflaeche
 * schickt sie von selbst (siehe istHintergrundAnfrage). Geschrieben wird hoechstens alle 30 Sekunden;
 * `sofortMerken` (Meldung "ich bin noch da") schreibt immer.
 * Die Hoechstdauer des Cookies (SESSION_TTL_HOURS) gilt unveraendert daneben.
 */
export async function pruefeSitzung(opts: { sofortMerken?: boolean } = {}): Promise<SitzungsStatus> {
  const sid = await sitzungsIdAusCookie();
  // Cookies aus der Zeit vor der Sitzungstabelle haben keine sid: einmal neu anmelden
  if (!sid) return KEINE;

  const sitzung = await prisma.sitzung.findUnique({ where: { id: sid }, include: { user: true } });
  if (!sitzung) return KEINE;
  if (sitzung.beendetAm) return sitzung.beendetGrund === 'inaktiv' ? INAKTIV : KEINE;
  if (!sitzung.user.aktiv) return KEINE;

  const jetzt = Date.now();
  const dauer = inaktivMs();
  const zuletzt = sitzung.letzteAktivitaet.getTime();
  if (istAbgelaufen(zuletzt, jetzt, dauer)) {
    const beendet = await prisma.sitzung.updateMany({
      where: { id: sid, beendetAm: null },
      data: { beendetAm: new Date(jetzt), beendetGrund: 'inaktiv' },
    });
    if (beendet.count > 0) {
      await audit(sitzung.user, 'LOGOUT', 'User', sitzung.user.id, 'Automatische Abmeldung nach Inaktivität');
    }
    return INAKTIV;
  }

  const hintergrund = istHintergrundAnfrage(await headers());
  if (!hintergrund && (opts.sofortMerken || jetzt - zuletzt >= schreibDrosselMs(dauer))) {
    await prisma.sitzung.updateMany({
      where: { id: sid, beendetAm: null },
      data: { letzteAktivitaet: new Date(jetzt) },
    });
  }
  return { user: toSessionUser(sitzung.user), grund: null };
}

/** Wie pruefeSitzung; innerhalb eines Seitenaufbaus wird nur einmal nachgesehen (cache). */
export const sitzungsStatus = cache(async (): Promise<SitzungsStatus> => pruefeSitzung());

/** Liest und verifiziert die Session. Gibt null zurueck wenn nicht angemeldet (siehe pruefeSitzung). */
export async function getSession(): Promise<SessionUser | null> {
  return (await sitzungsStatus()).user;
}

/**
 * Antwort 401 fuer API-Routen ohne gueltige Sitzung. Nach automatischer Abmeldung zusaetzlich
 * `code: 'inaktiv'`, damit die Oberflaeche den passenden Hinweis zeigen kann.
 */
export async function nichtAngemeldet(): Promise<NextResponse> {
  const { grund } = await sitzungsStatus();
  const kopf = { 'Cache-Control': 'no-store' };
  if (grund === 'inaktiv') {
    return NextResponse.json(
      { error: 'Automatisch abgemeldet (zu lange keine Eingabe)', code: 'inaktiv' },
      { status: 401, headers: kopf },
    );
  }
  return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401, headers: kopf });
}

/** Adresse der Anmeldeseite mit dem Hinweis auf die automatische Abmeldung. */
export const LOGIN_INAKTIV = '/login?abgemeldet=inaktiv';

/**
 * Angemeldeter Benutzer fuer Seiten und Server-Actions. Ohne gueltige Sitzung (nicht angemeldet,
 * Konto gesperrt oder geloescht) geht es zur Anmeldeseite; der Aufruf kehrt dann nicht zurueck.
 * Jede Seite prueft selbst: Das gemeinsame Layout wird beim Wechsel zwischen Seiten nicht neu ausgefuehrt.
 */
export async function requireUser(): Promise<SessionUser> {
  const status = await sitzungsStatus();
  if (!status.user) redirect(status.grund === 'inaktiv' ? LOGIN_INAKTIV : '/login');
  return status.user;
}

function toSessionUser(u: User): SessionUser {
  return {
    id: u.id,
    username: u.username,
    vorname: u.vorname,
    nachname: u.nachname,
    kuerzel: u.kuerzel,
    role: u.role,
  };
}

/** Prueft Zugangsdaten gegen die Datenbank (Benutzername + 4-stellige PIN). */
export async function authenticate(username: string, pin: string): Promise<SessionUser | null> {
  const u = await prisma.user.findUnique({ where: { username: username.toLowerCase().trim() } });
  if (!u || !u.aktiv) return null;
  const ok = await verifyPin(pin, u.passwordHash);
  if (!ok) return null;
  await prisma.user.update({ where: { id: u.id }, data: { letzterLogin: new Date() } });
  return toSessionUser(u);
}

/** Suche nach dem Anmeldenamen wie ihn das Portal schickt: ohne Beachtung der Gross-/Kleinschreibung. */
function portalKontoWhere(anmeldename: string) {
  return { username: { equals: anmeldename, mode: 'insensitive' as const } };
}

/**
 * Die Datenbank-Suche oben behandelt "_" und "%" im Namen als Platzhalter ("a_b" faende auch "axb").
 * Deshalb zaehlen nur Treffer, deren Benutzername wirklich gleich ist.
 */
function genauGleich<T extends { username: string }>(treffer: T[], anmeldename: string): T[] {
  const soll = anmeldename.toLowerCase();
  return treffer.filter((u) => u.username.toLowerCase() === soll);
}

/**
 * Anmeldung ueber das Portal (ohne PIN): sucht genau ein aktives Konto, dessen
 * Benutzername ohne Beachtung der Gross-/Kleinschreibung dem Anmeldenamen entspricht.
 */
export async function authenticatePortal(anmeldename: string): Promise<SessionUser | null> {
  const name = anmeldename.trim();
  if (!name) return null;
  const treffer = genauGleich(
    await prisma.user.findMany({ where: { ...portalKontoWhere(name), aktiv: true } }),
    name,
  );
  if (treffer.length !== 1) return null;
  const u = treffer[0];
  await prisma.user.update({ where: { id: u.id }, data: { letzterLogin: new Date() } });
  return toSessionUser(u);
}

/**
 * Konto-Auskunft fuer das Portal: gleiche Suche wie authenticatePortal, aber auch
 * deaktivierte Konten und ohne etwas zu aendern. `aktiv` ist nur dann true, wenn die
 * Anmeldung ueber das Portal gelingen wuerde (genau ein aktives Konto).
 */
export async function findePortalKonto(anmeldename: string): Promise<{ aktiv: boolean; role: Role } | null> {
  const name = anmeldename.trim();
  if (!name) return null;
  const treffer = genauGleich(
    await prisma.user.findMany({
      where: portalKontoWhere(name),
      orderBy: [{ aktiv: 'desc' }, { createdAt: 'asc' }],
      select: { aktiv: true, role: true, username: true },
    }),
    name,
  );
  if (treffer.length === 0) return null;
  const aktive = treffer.filter((u) => u.aktiv);
  return { aktiv: aktive.length === 1, role: treffer[0].role };
}

/**
 * Alle Konten (auch deaktivierte) zu einem Anmeldenamen, gleiche Suche wie authenticatePortal und
 * findePortalKonto. Fuer das Sperren ueber das Portal; `db` kann eine laufende Transaktion sein.
 */
export async function portalKontoTreffer(
  anmeldename: string,
  db: Prisma.TransactionClient = prisma,
): Promise<User[]> {
  const name = anmeldename.trim();
  if (!name) return [];
  return genauGleich(
    await db.user.findMany({
      where: portalKontoWhere(name),
      orderBy: [{ aktiv: 'desc' }, { createdAt: 'asc' }],
    }),
    name,
  );
}

/**
 * Schliesst eine erfolgreiche Anmeldung ab: Session-Cookie setzen und Audit-Eintrag
 * schreiben. Gemeinsamer Weg fuer PIN-Login und Portal-Anmeldung.
 */
export async function loginSession(user: SessionUser, details: string): Promise<void> {
  await createSession(user);
  await audit(user, 'LOGIN', 'User', user.id, details);
}
