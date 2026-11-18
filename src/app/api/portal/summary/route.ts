import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PORTAL_APP_ID, portalSecret, safeEqual } from '@/lib/portal';

export const dynamic = 'force-dynamic';

type KennzahlStatus = 'ok' | 'info' | 'warnung' | 'kritisch';
interface Kennzahl { id: string; label: string; wert: number; status: KennzahlStatus; pfad?: string }

const NO_STORE = { 'Cache-Control': 'no-store' };

// Wie im Dashboard: Datensaetze, die nicht mehr aktiv bearbeitet werden
const ABGESCHLOSSEN = ['EINGEZOGEN', 'ABGELEHNT', 'ARCHIVIERT'] as const;

/** Freie Plaetze wie im Dashboard: Gesamtplaetze minus belegte Plaetze je aktivem Standort. */
async function freiePlaetze(): Promise<number> {
  const [standorte, belegt] = await Promise.all([
    prisma.standort.findMany({ where: { aktiv: true }, select: { id: true, gesamtplaetze: true } }),
    prisma.platz.groupBy({ by: ['standortId'], where: { belegt: true }, _count: { _all: true } }),
  ]);
  const belegtMap = new Map(belegt.map((p) => [p.standortId, p._count._all]));
  return standorte.reduce(
    (sum, s) => sum + (s.gesamtplaetze != null ? Math.max(0, s.gesamtplaetze - (belegtMap.get(s.id) ?? 0)) : 0),
    0,
  );
}

/**
 * Kennzahlen fuer das Wunsch-Pflege Portal (nur Anzahlen, keine Namen).
 * Aufruf serverseitig durch das Portal mit "Authorization: Bearer <PORTAL_SECRET>".
 */
export async function GET(req: NextRequest) {
  const secret = portalSecret();
  if (!secret) return new NextResponse(null, { status: 404 });

  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ') || !safeEqual(auth.slice(7), secret)) {
    return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 401, headers: NO_STORE });
  }

  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 86_400_000);
  const vor90 = new Date(now.getTime() - 90 * 86_400_000);

  // Reihenfolge = Wichtigkeit. Definitionen entsprechen Dashboard bzw. Wiedervorlagen-Liste.
  const quellen: { id: string; label: string; status: KennzahlStatus; pfad: string; zaehlen: () => Promise<number> }[] = [
    {
      id: 'wiedervorlagen_ueberfaellig', label: 'Wiedervorlagen überfällig', status: 'kritisch', pfad: '/wiedervorlagen',
      zaehlen: () => prisma.wiedervorlage.count({ where: { erledigt: false, faelligAm: { lt: now } } }),
    },
    {
      id: 'rueckmeldungen_ueberfaellig', label: 'Rückmeldungen überfällig', status: 'kritisch', pfad: '/warteliste',
      zaehlen: () => prisma.interessent.count({ where: { rueckmeldungBis: { lt: now }, status: { notIn: [...ABGESCHLOSSEN] } } }),
    },
    {
      id: 'wiedervorlagen_faellig', label: 'Wiedervorlagen in 7 Tagen fällig', status: 'warnung', pfad: '/wiedervorlagen',
      zaehlen: () => prisma.wiedervorlage.count({ where: { erledigt: false, faelligAm: { gte: now, lte: in7 } } }),
    },
    {
      id: 'neue_anfragen', label: 'Neue Anfragen unbearbeitet', status: 'warnung', pfad: '/warteliste?status=NEUE_ANFRAGE',
      zaehlen: () => prisma.interessent.count({ where: { status: 'NEUE_ANFRAGE' } }),
    },
    {
      id: 'lange_wartezeit', label: 'Wartezeit über 3 Monate', status: 'warnung', pfad: '/warteliste',
      zaehlen: () => prisma.interessent.count({ where: { createdAt: { lte: vor90 }, status: { notIn: [...ABGESCHLOSSEN] } } }),
    },
    {
      id: 'freie_plaetze', label: 'Freie Plätze', status: 'info', pfad: '/plaetze',
      zaehlen: freiePlaetze,
    },
  ];

  const ergebnisse = await Promise.allSettled(quellen.map((q) => q.zaehlen()));
  const kennzahlen: Kennzahl[] = [];
  ergebnisse.forEach((r, i) => {
    const q = quellen[i];
    if (r.status !== 'fulfilled') {
      // Einzelne Kennzahl fehlgeschlagen -> weglassen, Rest trotzdem liefern
      console.error(`[portal] Kennzahl ${q.id} fehlgeschlagen`);
      return;
    }
    kennzahlen.push({ id: q.id, label: q.label, wert: r.value, status: r.value === 0 ? 'ok' : q.status, pfad: q.pfad });
  });

  return NextResponse.json(
    { app: PORTAL_APP_ID, version: 1, stand: now.toISOString(), kennzahlen },
    { headers: NO_STORE },
  );
}
