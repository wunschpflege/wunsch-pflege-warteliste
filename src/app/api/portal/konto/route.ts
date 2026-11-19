import { randomBytes } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import type { Role } from '@prisma/client';
import { findePortalKonto, hashPin } from '@/lib/auth';
import { benutzerAnlegen } from '@/lib/benutzer';
import { ROLE_LABEL } from '@/lib/rbac';
import { PORTAL_NO_STORE, portalAbweisung } from '@/lib/portal';
import { BENUTZERNAME_REGEL, istRolle, portalBenutzername } from '@/lib/portal-konto';

export const dynamic = 'force-dynamic';

const MAX_NAME = 100;

function fehler(text: string): NextResponse {
  return NextResponse.json({ error: text }, { status: 400, headers: PORTAL_NO_STORE });
}

function auskunft(konto: { aktiv: boolean; role: Role }) {
  return { vorhanden: true, aktiv: konto.aktiv, rolle: konto.role, rolle_name: ROLE_LABEL[konto.role] };
}

function text(wert: unknown): string {
  return typeof wert === 'string' ? wert.trim() : '';
}

/**
 * Auskunft, ob es zu einem Anmeldenamen ein Konto gibt (Suche wie bei /api/portal/sso).
 * Aufruf serverseitig durch das Portal mit "Authorization: Bearer <PORTAL_SECRET>".
 */
export async function GET(req: NextRequest) {
  const abweisung = portalAbweisung(req);
  if (abweisung) return abweisung;

  const benutzername = text(req.nextUrl.searchParams.get('benutzername'));
  if (!benutzername) return fehler('Benutzername fehlt.');

  const konto = await findePortalKonto(benutzername);
  return NextResponse.json(konto ? auskunft(konto) : { vorhanden: false }, { headers: PORTAL_NO_STORE });
}

/**
 * Legt ein Konto mit der gewaehlten Rolle an, falls es noch keins gibt. Vorhandene Konten
 * werden nie veraendert (auch nicht reaktiviert). Das neue Konto bekommt keine benutzbare PIN:
 * Anmeldung zunaechst nur ueber das Portal, bis die Benutzerverwaltung eine PIN vergibt.
 */
export async function POST(req: NextRequest) {
  const abweisung = portalAbweisung(req);
  if (abweisung) return abweisung;

  let body: Record<string, unknown>;
  try {
    const b: unknown = await req.json();
    if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error('kein Objekt');
    body = b as Record<string, unknown>;
  } catch {
    return fehler('Anfrage ist kein gültiges JSON.');
  }

  const eingabe = text(body.benutzername);
  if (!eingabe) return fehler('Benutzername fehlt.');

  // Gibt es das Konto schon (gleiche Suche wie /sso): nichts aendern
  const vorhanden = await findePortalKonto(eingabe);
  if (vorhanden) {
    return NextResponse.json({ angelegt: false, ...auskunft(vorhanden) }, { headers: PORTAL_NO_STORE });
  }

  const username = portalBenutzername(eingabe);
  if (!username) return fehler(BENUTZERNAME_REGEL);
  const vorname = text(body.vorname);
  const nachname = text(body.nachname);
  if (!vorname) return fehler('Vorname erforderlich');
  if (!nachname) return fehler('Nachname erforderlich');
  if (vorname.length > MAX_NAME || nachname.length > MAX_NAME) return fehler(`Vor- und Nachname dürfen höchstens ${MAX_NAME} Zeichen lang sein.`);
  const role = body.rolle;
  if (!istRolle(role)) return fehler('Unbekannte Rolle. Erlaubt sind die Rollen aus /api/portal/rollen.');

  try {
    // Zufalls-Geheimnis statt PIN: niemand kennt es, und die PIN-Anmeldung nimmt ohnehin nur 4 Ziffern an
    const passwordHash = await hashPin(randomBytes(32).toString('hex'));
    const neu = await benutzerAnlegen({ vorname, nachname, role, username, passwordHash }, null, 'über Portal');
    return NextResponse.json({ angelegt: true, ...auskunft(neu) }, { status: 201, headers: PORTAL_NO_STORE });
  } catch (e) {
    // Gleichzeitig von anderer Seite angelegt (Benutzername ist eindeutig): wie "schon vorhanden" behandeln
    if ((e as { code?: string })?.code === 'P2002') {
      const konto = await findePortalKonto(username);
      if (konto) return NextResponse.json({ angelegt: false, ...auskunft(konto) }, { headers: PORTAL_NO_STORE });
    }
    console.error('[portal] Konto anlegen fehlgeschlagen');
    return NextResponse.json({ error: 'Konto konnte nicht angelegt werden.' }, { status: 500, headers: PORTAL_NO_STORE });
  }
}
