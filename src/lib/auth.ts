import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { audit } from './audit';
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

/** Erzeugt ein signiertes JWT und setzt das Session-Cookie. */
export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({ ...user })
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

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

/**
 * Liest und verifiziert die Session. Gibt null zurueck wenn nicht angemeldet.
 *
 * Das Cookie allein reicht nicht: Bei jeder Anfrage wird in der Datenbank nachgesehen, ob es das
 * Konto noch gibt und ob es aktiv ist. So wirkt eine Sperre (Benutzerverwaltung oder Portal) sofort
 * und nicht erst, wenn das Cookie ablaeuft. Name, Kuerzel und Rolle kommen aus der Datenbank,
 * nicht aus dem Cookie; eine geaenderte Rolle gilt damit ebenfalls sofort.
 * Innerhalb eines Seitenaufbaus wird nur einmal nachgesehen (cache).
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  let id: string;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.id !== 'string' || !payload.id) return null;
    id = payload.id;
  } catch {
    return null;
  }
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u || !u.aktiv) return null;
  return toSessionUser(u);
});

/**
 * Angemeldeter Benutzer fuer Seiten und Server-Actions. Ohne gueltige Sitzung (nicht angemeldet,
 * Konto gesperrt oder geloescht) geht es zur Anmeldeseite; der Aufruf kehrt dann nicht zurueck.
 * Jede Seite prueft selbst: Das gemeinsame Layout wird beim Wechsel zwischen Seiten nicht neu ausgefuehrt.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect('/login');
  return user;
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
