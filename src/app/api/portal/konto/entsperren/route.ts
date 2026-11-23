import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { portalKontoEntsperren } from '@/lib/benutzer';
import { PORTAL_NO_STORE, portalAbweisung } from '@/lib/portal';

export const dynamic = 'force-dynamic';

function fehler(text: string, status = 400): NextResponse {
  return NextResponse.json({ error: text }, { status, headers: PORTAL_NO_STORE });
}

/**
 * Entsperrt ein Konto aus dem Portal heraus (Gegenstueck zu /api/portal/konto/sperren).
 * Aufruf serverseitig durch das Portal mit "Authorization: Bearer <PORTAL_SECRET>".
 * Gleiche Kontosuche wie /api/portal/sso und /api/portal/konto; beliebig oft wiederholbar.
 * Das Konto wird aktiviert wie in der Benutzerverwaltung; die PIN bleibt, es entsteht keine Sitzung.
 * Geloeschte Konten gibt es in der Warteliste nicht mehr (kein Wiederbeleben moeglich): "vorhanden: false".
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
    const ergebnis = await portalKontoEntsperren(benutzername);
    switch (ergebnis.status) {
      case 'unbekannt':
        return NextResponse.json({ vorhanden: false }, { headers: PORTAL_NO_STORE });
      case 'mehrdeutig':
        return fehler(
          'Nicht entsperrt: Zu diesem Benutzernamen gibt es mehrere gesperrte Konten. Bitte in der Benutzerverwaltung der Warteliste entsperren.',
          409,
        );
      case 'aktiv':
        if (!ergebnis.vorherAktiv) revalidatePath('/benutzer');
        return NextResponse.json(
          { vorhanden: true, aktiv: true, vorher_aktiv: ergebnis.vorherAktiv },
          { headers: PORTAL_NO_STORE },
        );
    }
  } catch {
    console.error('[portal] Konto entsperren fehlgeschlagen');
    return fehler('Konto konnte nicht entsperrt werden.', 500);
  }
}
