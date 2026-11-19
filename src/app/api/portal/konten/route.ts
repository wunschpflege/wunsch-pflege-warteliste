import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_MATRIX, getMatrix, ROLE_LABEL } from '@/lib/rbac';
import { PORTAL_NO_STORE, portalAbweisung, nurPortalAnmeldung } from '@/lib/portal';

export const dynamic = 'force-dynamic';

/**
 * Alle Konten der Warteliste (auch gesperrte) fuer die Sicherheitsuebersicht im Portal.
 * Aufruf serverseitig durch das Portal mit "Authorization: Bearer <PORTAL_SECRET>".
 * Es werden nur die unten ausgewaehlten Spalten gelesen – nie der PIN-Hash.
 */
export async function GET(req: NextRequest) {
  const abweisung = portalAbweisung(req);
  if (abweisung) return abweisung;

  try {
    const [konten, matrix] = await Promise.all([
      prisma.user.findMany({
        select: { username: true, vorname: true, nachname: true, aktiv: true, role: true, letzterLogin: true },
        orderBy: [{ nachname: 'asc' }, { vorname: 'asc' }, { username: 'asc' }],
        take: 1000,
      }),
      getMatrix(),
    ]);
    return NextResponse.json(
      {
        nur_portal: nurPortalAnmeldung(),
        konten: konten.map((k) => ({
          benutzername: k.username,
          name: `${k.vorname} ${k.nachname}`.trim(),
          aktiv: k.aktiv,
          rolle: k.role,
          rolle_name: ROLE_LABEL[k.role],
          // Volle Verwaltungsrechte: Geschaeftsfuehrung, ausserdem jede Rolle, der die
          // Berechtigungsmatrix die Benutzerverwaltung (und damit die Matrix selbst) gibt
          verwaltung: k.role === 'GESCHAEFTSFUEHRUNG' || (matrix[k.role] ?? DEFAULT_MATRIX[k.role]).includes('user.manage'),
          letzte_anmeldung: k.letzterLogin ? k.letzterLogin.toISOString() : null,
        })),
      },
      { headers: PORTAL_NO_STORE },
    );
  } catch {
    console.error('[portal] Kontenliste fehlgeschlagen');
    return NextResponse.json({ error: 'Konten konnten nicht geladen werden.' }, { status: 500, headers: PORTAL_NO_STORE });
  }
}
