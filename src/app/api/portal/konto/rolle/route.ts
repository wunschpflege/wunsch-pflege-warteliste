import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { portalRolleAendern, LETZTE_VERWALTUNG_ROLLE } from '@/lib/benutzer';
import { ROLE_LABEL } from '@/lib/rbac';
import { PORTAL_NO_STORE, portalAbweisung } from '@/lib/portal';
import { istRolle } from '@/lib/portal-konto';

export const dynamic = 'force-dynamic';

function fehler(text: string, status = 400): NextResponse {
  return NextResponse.json({ error: text }, { status, headers: PORTAL_NO_STORE });
}

/**
 * Aendert die Rolle eines Kontos aus dem Portal heraus (Rollen-IDs wie in /api/portal/rollen).
 * Aufruf serverseitig durch das Portal mit "Authorization: Bearer <PORTAL_SECRET>".
 * Gleiche Kontosuche wie /api/portal/sso und /api/portal/konto. Geschrieben wird nur die Rolle;
 * der Benutzername bleibt, wie er ist. Die neue Rolle gilt sofort, auch fuer laufende Sitzungen.
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
  const rolle = body.rolle;
  if (!istRolle(rolle)) return fehler('Unbekannte Rolle.');

  try {
    const ergebnis = await portalRolleAendern(benutzername, rolle);
    switch (ergebnis.status) {
      case 'unbekannt':
        return NextResponse.json({ vorhanden: false }, { headers: PORTAL_NO_STORE });
      case 'letzte_verwaltung':
        return fehler(LETZTE_VERWALTUNG_ROLLE, 409);
      case 'mehrdeutig':
        return fehler(
          'Rolle nicht geändert: Zu diesem Benutzernamen gibt es mehrere Konten. Bitte in der Benutzerverwaltung der Warteliste ändern.',
          409,
        );
      case 'geaendert':
        if (ergebnis.vorher !== ergebnis.rolle) revalidatePath('/benutzer');
        return NextResponse.json(
          { vorhanden: true, rolle: ergebnis.rolle, rolle_name: ROLE_LABEL[ergebnis.rolle], vorher: ergebnis.vorher },
          { headers: PORTAL_NO_STORE },
        );
    }
  } catch {
    console.error('[portal] Rolle ändern fehlgeschlagen');
    return fehler('Rolle konnte nicht geändert werden.', 500);
  }
}
