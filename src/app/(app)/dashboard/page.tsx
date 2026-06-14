import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { STATUS_LABEL, STATUS_COLOR, fmtDateTime, fmtDate, WV_TYP_LABEL } from '@/lib/labels';
import AktivitaetenBlock from '@/components/AktivitaetenBlock';

export const dynamic = 'force-dynamic';

function StatCard({ label, value, href, accent }: { label: string; value: number | string; href?: string; accent?: string }) {
  const inner = (
    <div className="card p-4 h-full">
      <p className="text-sm text-muted">{label}</p>
      <p className={`text-3xl font-semibold mt-1 ${accent ?? ''}`}>{value}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default async function Dashboard() {
  const user = await getSession();
  const now = new Date();
  const weekAgo = new Date(Date.now() - 5 * 86_400_000);
  const in7 = new Date(Date.now() + 7 * 86_400_000);

  const aktiveStatus = ['NEUE_ANFRAGE', 'WARTELISTE', 'BESICHTIGUNG_GEPLANT', 'AUFNAHME_IN_VORBEREITUNG', 'PLATZ_ANGEBOTEN'] as const;

  const [
    freiePlaetze, warteliste, neueWoche, rueckrufe,
    plaetzeProStandort, wiedervorlagen, letzteAktivitaeten,
    langeWartezeit, ueberfaelligeRueckmeldungen,
  ] = await Promise.all([
    prisma.platz.count({ where: { belegt: false } }),
    prisma.interessent.count({ where: { status: { in: ['WARTELISTE', 'NEUE_ANFRAGE', 'BESICHTIGUNG_GEPLANT'] } } }),
    prisma.interessent.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.wiedervorlage.count({ where: { typ: 'RUECKRUF', erledigt: false, faelligAm: { lte: in7 } } }),
    prisma.platz.groupBy({ by: ['standortId'], where: { belegt: false }, _count: { _all: true } }),
    prisma.wiedervorlage.findMany({
      where: { erledigt: false, faelligAm: { lte: in7 } },
      include: { interessent: true },
      orderBy: { faelligAm: 'asc' },
      take: 8,
    }),
    prisma.auditLog.findMany({ orderBy: { zeitpunkt: 'desc' }, take: 50 }),
    prisma.interessent.count({ where: { createdAt: { lte: new Date(Date.now() - 90 * 86400000) }, status: { notIn: ['EINGEZOGEN', 'ABGELEHNT', 'ARCHIVIERT'] } } }),
    prisma.interessent.count({ where: { rueckmeldungBis: { lt: now }, status: { notIn: ['EINGEZOGEN', 'ABGELEHNT', 'ARCHIVIERT'] } } }),
  ]);

  const standorte = await prisma.standort.findMany({ where: { aktiv: true }, orderBy: { name: 'asc' } });
  const freiMap = new Map(plaetzeProStandort.map((p) => [p.standortId, p._count._all]));

  const neuListe = await prisma.interessent.findMany({
    where: { createdAt: { gte: weekAgo } },
    include: { standort: true, erstelltVon: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Willkommen, {user?.vorname}</h1>
        <p className="text-muted text-sm">Übersicht vom {fmtDate(now)}</p>
      </div>

      {(langeWartezeit > 0 || ueberfaelligeRueckmeldungen > 0) && (
        <div className="space-y-2">
          {langeWartezeit > 0 && (
            <div className="rounded-xl bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 px-4 py-3 text-red-800 dark:text-red-200 text-sm font-medium">
              ⚠ {langeWartezeit} {langeWartezeit === 1 ? 'Person wartet' : 'Personen warten'} länger als 3 Monate
            </div>
          )}
          {ueberfaelligeRueckmeldungen > 0 && (
            <div className="rounded-xl bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-800 px-4 py-3 text-orange-800 dark:text-orange-200 text-sm font-medium">
              ⏰ {ueberfaelligeRueckmeldungen} {ueberfaelligeRueckmeldungen === 1 ? 'Rückmeldung überfällig' : 'Rückmeldungen überfällig'}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Aktiv auf der Warteliste" value={warteliste} href="/warteliste" />
        <StatCard label="Neu (5 Tage)" value={neueWoche} href="/warteliste" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Freie Plätze nach Standort */}
        <section className="card p-5">
          <details>
            <summary className="font-semibold cursor-pointer select-none">Freie Plätze nach Standort</summary>
            <div className="space-y-1.5 mt-3">
              {standorte.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm py-1 border-b border-[var(--border)] last:border-0">
                  <span>{s.name}</span>
                  <span className={`badge ${(freiMap.get(s.id) ?? 0) > 0 ? 'bg-brand-100 text-brand-800' : 'bg-gray-100 text-gray-500'}`}>
                    {freiMap.get(s.id) ?? 0} frei
                  </span>
                </div>
              ))}
              {standorte.length === 0 && <p className="text-sm text-muted">Keine Standorte angelegt.</p>}
            </div>
          </details>
        </section>

        {/* Anstehende Wiedervorlagen */}
        <section className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Anstehende Wiedervorlagen</h2>
            <Link href="/wiedervorlagen" className="text-sm text-brand-600 hover:underline">Alle</Link>
          </div>
          <div className="space-y-2">
            {wiedervorlagen.map((w) => {
              const overdue = new Date(w.faelligAm) < now;
              return (
                <div key={w.id} className="flex items-start justify-between text-sm gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{w.titel}</p>
                    <p className="text-xs text-muted">
                      {WV_TYP_LABEL[w.typ]}
                      {w.interessent ? ` · ${w.interessent.vorname} ${w.interessent.nachname}` : ''}
                    </p>
                  </div>
                  <span className={`badge whitespace-nowrap ${overdue ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    {fmtDate(w.faelligAm)}
                  </span>
                </div>
              );
            })}
            {wiedervorlagen.length === 0 && <p className="text-sm text-muted">Keine anstehenden Wiedervorlagen.</p>}
          </div>
        </section>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Neu eingetragene Interessenten */}
        <section className="card p-5">
          <h2 className="font-semibold mb-3">Neu eingetragene Interessenten</h2>
          <div className="space-y-2">
            {neuListe.map((i) => (
              <Link key={i.id} href={`/warteliste/${i.id}`} className="flex items-center justify-between text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded-lg px-2 py-1.5 -mx-2">
                <div>
                  <p className="font-medium">{i.vorname} {i.nachname}</p>
                  <p className="text-xs text-muted">{i.standort?.name ?? 'Kein Standort'} · {fmtDate(i.createdAt)}</p>
                </div>
                <span className={`badge ${STATUS_COLOR[i.status]}`}>{STATUS_LABEL[i.status]}</span>
              </Link>
            ))}
            {neuListe.length === 0 && <p className="text-sm text-muted">Keine neuen Einträge in den letzten 5 Tagen.</p>}
          </div>
        </section>

        <AktivitaetenBlock items={letzteAktivitaeten} />
      </div>
    </div>
  );
}
