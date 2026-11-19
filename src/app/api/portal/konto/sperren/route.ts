import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { portalKontoSperren } from '@/lib/benutzer';
import { PORTAL_NO_STORE, portalAbweisung } from '@/lib/portal';

export const dynamic = 'force-dynamic';

function fehler(text: string, status = 400): NextResponse {
  return NextResponse.json({ error: text }, { status, headers: PORTAL_NO_STORE });
}

/**
 * Sperrt ein Konto aus dem Portal heraus (z. B. wenn jemand das Unternehmen verlaesst).
 * Aufruf serverseitig durch das Portal mit "Authorization: Bearer <PORTAL_SECRET>".
 * Gleiche Kontosuche wie /api/portal/sso und /api/portal/konto; beliebig oft wiederholbar.
 * Die Sperre wirkt sofort: Jede Anfrage prueft das Konto in der Datenbank (getSession).
 * Entsperrt wird hier nie – das geht nur in der Benutzerverwaltung.
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

  const benutzername = typeof body.benutzername === 'string' ? body.benutzername.trim() : '';
  if (!benutzername) return fehler('Benutzername fehlt.');

  try {
    const ergebnis = await portalKontoSperren(benutzername);
    switch (ergebnis.status) {
      case 'unbekannt':
        return NextResponse.json({ vorhanden: false }, { headers: PORTAL_NO_STORE });
      case 'letzte_verwaltung':
        return fehler(
          'Nicht gesperrt: Das ist das letzte aktive Konto der Geschäftsführung in der Warteliste. Bitte dort zuerst ein anderes Konto mit dieser Rolle einrichten.',
          409,
        );
      case 'mehrdeutig':
        return fehler(
          'Nicht gesperrt: Zu diesem Benutzernamen gibt es mehrere aktive Konten. Bitte in der Benutzerverwaltung der Warteliste sperren.',
          409,
        );
      case 'gesperrt':
        if (ergebnis.vorherAktiv) revalidatePath('/benutzer');
        return NextResponse.json(
          { vorhanden: true, gesperrt: true, vorher_aktiv: ergebnis.vorherAktiv },
          { headers: PORTAL_NO_STORE },
        );
    }
  } catch {
    console.error('[portal] Konto sperren fehlgeschlagen');
    return fehler('Konto konnte nicht gesperrt werden.', 500);
  }
}
