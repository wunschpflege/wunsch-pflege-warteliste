import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { findePortalKonto } from '@/lib/auth';
import { DEFAULT_MATRIX, getMatrix, type Permission } from '@/lib/rbac';
import { PORTAL_NO_STORE, portalAbweisung } from '@/lib/portal';
import { baueAufgaben, EINZELN_MAX, type AufgabenDaten } from '@/lib/portal-aufgaben';

export const dynamic = 'force-dynamic';

// Wie in /api/portal/summary und im Dashboard: Datensaetze, die nicht mehr aktiv bearbeitet werden
const ABGESCHLOSSEN = ['EINGEZOGEN', 'ABGELEHNT', 'ARCHIVIERT'] as const;

/** Gibt das Ergebnis zurueck oder undefined, wenn die Quelle fehlschlaegt (wird dann weggelassen). */
async function versuche<T>(name: string, abfrage: () => Promise<T>): Promise<T | undefined> {
  try {
    return await abfrage();
  } catch {
    console.error(`[portal] Aufgaben: Quelle ${name} fehlgeschlagen`);
    return undefined;
  }
}

/**
 * Offene Punkte hinter den Kennzahlen aus /api/portal/summary, fuer "Was ist zu tun" im Portal.
 * Aufruf serverseitig durch das Portal mit "Authorization: Bearer <PORTAL_SECRET>".
 * Gleiche Quellen und Einstufung wie /summary; geliefert wird nur, was das Konto mit seiner Rolle
 * in der Warteliste selbst sehen darf. Ohne Namen und Freitexte (siehe src/lib/portal-aufgaben.ts):
 * die Abfragen waehlen nur ID, Art und Datum aus.
 */
export async function GET(req: NextRequest) {
  const abweisung = portalAbweisung(req);
  if (abweisung) return abweisung;

  const benutzername = (req.nextUrl.searchParams.get('benutzername') ?? '').trim();
  if (!benutzername) {
    return NextResponse.json({ error: 'Benutzername fehlt.' }, { status: 400, headers: PORTAL_NO_STORE });
  }

  try {
    // Gleiche Kontosuche wie /sso und /konto; `aktiv` heisst: Anmeldung ueber das Portal wuerde gelingen
    const konto = await findePortalKonto(benutzername);
    if (!konto || !konto.aktiv) {
      return NextResponse.json({ vorhanden: false, aufgaben: [] }, { headers: PORTAL_NO_STORE });
    }

    // Rechte der Rolle aus der Berechtigungsmatrix (Einstellungen), wie sie im Programm gilt
    const rechte: Permission[] = (await getMatrix())[konto.role] ?? DEFAULT_MATRIX[konto.role] ?? [];
    // Wiedervorlagen: Seite /wiedervorlagen verlangt dieses Recht
    const darfWiedervorlagen = rechte.includes('wiedervorlage.manage');
    // Einzelne Interessenten (/warteliste/<id>) verlangen dieses Recht
    const darfInteressenten = rechte.includes('interessent.read');

    const jetzt = new Date();
    const in7 = new Date(jetzt.getTime() + 7 * 86_400_000);
    const vor90 = new Date(jetzt.getTime() - 90 * 86_400_000);

    const wvUeberfaellig = { erledigt: false, faelligAm: { lt: jetzt } };
    const wvFaellig = { erledigt: false, faelligAm: { gte: jetzt, lte: in7 } };
    const rueckmeldung = { rueckmeldungBis: { lt: jetzt }, status: { notIn: [...ABGESCHLOSSEN] } };
    const wvAuswahl = { id: true, typ: true, faelligAm: true } as const;

    const [a, b, c, d, e, f] = await Promise.all([
      darfWiedervorlagen
        ? versuche('wiedervorlagen_ueberfaellig', async () => ({
            anzahl: await prisma.wiedervorlage.count({ where: wvUeberfaellig }),
            punkte: await prisma.wiedervorlage.findMany({ where: wvUeberfaellig, select: wvAuswahl, orderBy: { faelligAm: 'asc' }, take: EINZELN_MAX }),
          }))
        : undefined,
      darfWiedervorlagen
        ? versuche('wiedervorlagen_faellig', async () => ({
            anzahl: await prisma.wiedervorlage.count({ where: wvFaellig }),
            punkte: await prisma.wiedervorlage.findMany({ where: wvFaellig, select: wvAuswahl, orderBy: { faelligAm: 'asc' }, take: EINZELN_MAX }),
          }))
        : undefined,
      darfInteressenten
        ? versuche('rueckmeldungen_ueberfaellig', async () => {
            const punkte = await prisma.interessent.findMany({
              where: rueckmeldung, select: { id: true, rueckmeldungBis: true }, orderBy: { rueckmeldungBis: 'asc' }, take: EINZELN_MAX,
            });
            return {
              anzahl: await prisma.interessent.count({ where: rueckmeldung }),
              punkte: punkte.flatMap((p) => (p.rueckmeldungBis ? [{ id: p.id, rueckmeldungBis: p.rueckmeldungBis }] : [])),
            };
          })
        : undefined,
      darfInteressenten
        ? versuche('neue_anfragen', async () => {
            const r = await prisma.interessent.aggregate({ where: { status: 'NEUE_ANFRAGE' }, _count: { _all: true }, _min: { createdAt: true } });
            return { anzahl: r._count._all, aelteste: r._min.createdAt };
          })
        : undefined,
      darfInteressenten
        ? versuche('lange_wartezeit', async () => ({
            anzahl: await prisma.interessent.count({ where: { createdAt: { lte: vor90 }, status: { notIn: [...ABGESCHLOSSEN] } } }),
            grenze: vor90,
          }))
        : undefined,
      // "Unsere Haeuser" (/plaetze) sieht jedes angemeldete Konto; hier nur Standortname und Anzahl
      versuche('freie_plaetze', async () => {
        const [standorte, belegt] = await Promise.all([
          prisma.standort.findMany({ where: { aktiv: true }, select: { id: true, name: true, gesamtplaetze: true }, orderBy: { name: 'asc' } }),
          prisma.platz.groupBy({ by: ['standortId'], where: { belegt: true }, _count: { _all: true } }),
        ]);
        const belegtMap = new Map(belegt.map((p) => [p.standortId, p._count._all]));
        return standorte.map((s) => ({
          name: s.name,
          frei: s.gesamtplaetze != null ? Math.max(0, s.gesamtplaetze - (belegtMap.get(s.id) ?? 0)) : 0,
        }));
      }),
    ]);

    const daten: AufgabenDaten = {
      wvUeberfaellig: a, wvFaellig: b, rueckmeldungen: c, neueAnfragen: d, langeWartezeit: e, freiePlaetze: f,
    };
    return NextResponse.json({ vorhanden: true, aufgaben: baueAufgaben(daten, jetzt) }, { headers: PORTAL_NO_STORE });
  } catch {
    console.error('[portal] Aufgabenliste fehlgeschlagen');
    return NextResponse.json({ error: 'Aufgaben konnten nicht geladen werden.' }, { status: 500, headers: PORTAL_NO_STORE });
  }
}
