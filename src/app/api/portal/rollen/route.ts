import { NextResponse, type NextRequest } from 'next/server';
import { ROLE_LABEL } from '@/lib/rbac';
import { PORTAL_NO_STORE, portalAbweisung } from '@/lib/portal';
import { PORTAL_ROLLEN, PORTAL_STANDARD_ROLLE } from '@/lib/portal-konto';

export const dynamic = 'force-dynamic';

/**
 * Rollen, die ein Konto in der Warteliste haben kann (fuer die Auswahl im Portal).
 * Aufruf serverseitig durch das Portal mit "Authorization: Bearer <PORTAL_SECRET>".
 */
export async function GET(req: NextRequest) {
  const abweisung = portalAbweisung(req);
  if (abweisung) return abweisung;

  return NextResponse.json(
    { rollen: PORTAL_ROLLEN.map((id) => ({ id, name: ROLE_LABEL[id] })), standard: PORTAL_STANDARD_ROLLE },
    { headers: PORTAL_NO_STORE },
  );
}
