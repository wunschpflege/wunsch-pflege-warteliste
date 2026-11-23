import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PORTAL_NO_STORE, portalAbweisung } from '@/lib/portal';
import {
  baueAntwort, markeLesen, EREIGNIS_AKTIONEN, NEU_MAX, START_MAX,
} from '@/lib/portal-aktivitaet';

export const dynamic = 'force-dynamic';

/**
 * Eintraege, die juenger sind als diese Frist, werden erst beim naechsten Abruf geliefert.
 * Zwei fast gleichzeitige Eintraege koennen in anderer Reihenfolge sichtbar werden, als ihre
 * Zeitstempel sagen; mit der Frist rutscht keiner hinter die Marke.
 */
const KARENZ_MS = 1500;

const AUSWAHL = {
  id: true, zeitpunkt: true, aktion: true, entitaet: true, entitaetId: true, details: true,
  user: { select: { username: true, vorname: true, nachname: true } },
} as const;

/**
 * Was in der Warteliste geschieht (anlegen, aendern, erledigen, loeschen, Anmeldungen), fuer die
 * Zentrale des Portals. Aufruf serverseitig durch das Portal mit "Authorization: Bearer <PORTAL_SECRET>".
 * Quelle ist der Audit-Trail; eine Abfrage ueber den Index auf `zeitpunkt`.
 * Ohne Namen betroffener Personen und ohne gespeicherte Texte (siehe src/lib/portal-aktivitaet.ts).
 * ?nach=<marke>: nur Ereignisse danach, aelteste zuerst, hoechstens 50. Ohne `nach` (oder mit einer
 * Marke, die nicht von hier stammt): die letzten 10.
 */
export async function GET(req: NextRequest) {
  const abweisung = portalAbweisung(req);
  if (abweisung) return abweisung;

  const nach = markeLesen(req.nextUrl.searchParams.get('nach'));
  const bis = new Date(Date.now() - KARENZ_MS);

  try {
    const zeilen = nach
      ? await prisma.auditLog.findMany({
          where: {
            aktion: { in: EREIGNIS_AKTIONEN },
            zeitpunkt: { lte: bis },
            OR: [{ zeitpunkt: { gt: nach.zeit } }, { zeitpunkt: nach.zeit, id: { gt: nach.id } }],
          },
          orderBy: [{ zeitpunkt: 'asc' }, { id: 'asc' }],
          take: NEU_MAX,
          select: AUSWAHL,
        })
      : (
          await prisma.auditLog.findMany({
            where: { aktion: { in: EREIGNIS_AKTIONEN }, zeitpunkt: { lte: bis } },
            orderBy: [{ zeitpunkt: 'desc' }, { id: 'desc' }],
            take: START_MAX,
            select: AUSWAHL,
          })
        ).reverse();
    return NextResponse.json(baueAntwort(zeilen, nach), { headers: PORTAL_NO_STORE });
  } catch {
    console.error('[portal] Aktivität fehlgeschlagen');
    return NextResponse.json({ error: 'Aktivität konnte nicht geladen werden.' }, { status: 500, headers: PORTAL_NO_STORE });
  }
}
