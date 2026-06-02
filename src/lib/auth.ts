import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import type { Role } from '@prisma/client';

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

/** Liest und verifiziert die Session. Gibt null zurueck wenn nicht angemeldet. */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: String(payload.id),
      username: String(payload.username),
      vorname: String(payload.vorname),
      nachname: String(payload.nachname),
      kuerzel: String(payload.kuerzel),
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

/** Wirft, wenn nicht angemeldet. Fuer Server-Komponenten/Actions. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new Error('UNAUTHENTICATED');
  return user;
}

/** Prueft Zugangsdaten gegen die Datenbank (Benutzername + 4-stellige PIN). */
export async function authenticate(username: string, pin: string): Promise<SessionUser | null> {
  const u = await prisma.user.findUnique({ where: { username: username.toLowerCase().trim() } });
  if (!u || !u.aktiv) return null;
  const ok = await verifyPin(pin, u.passwordHash);
  if (!ok) return null;
  await prisma.user.update({ where: { id: u.id }, data: { letzterLogin: new Date() } });
  return {
    id: u.id,
    username: u.username,
    vorname: u.vorname,
    nachname: u.nachname,
    kuerzel: u.kuerzel,
    role: u.role,
  };
}
