import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { STATUS_LABEL, STATUS_COLOR, fmtDateTime, fmtDate, WV_TYP_LABEL } from '@/lib/labels';

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
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const in7 = new Date(Date.now() + 7 * 86_400_000);

  const aktiveStatus = ['NEUE_ANFRAGE', 'WARTELISTE', 'BESICHTIGUNG_GEPLANT', 'AUFNAHME_IN_VORBEREITUNG', 'PLATZ_ANGEBOTEN'] as const;

  const [
    freiePlaetze, warteliste, neueWoche, rueckrufe,
    plaetzeProStandort, wiedervorlagen, letzteAktivitaeten,
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
    prisma.auditLog.findMany({ orderBy: { zeitpunkt: 'desc' }, take: 10 }),
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Freie WG-Plätze" value={freiePlaetze} href="/plaetze" accent="text-brand-600" />
        <StatCard label="Auf der Warteliste" value={warteliste} href="/warteliste" />
        <StatCard label="Neu (7 Tage)" value={neueWoche} href="/warteliste" />
        <StatCard label="Aktuelle Rückrufe" value={rueckrufe} href="/wiedervorlagen" accent="text-amber-600" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Freie Plätze nach Standort */}
        <section className="card p-5">
          <h2 className="font-semibold mb-3">Freie Plätze nach Standort</h2>
          <div className="space-y-1.5">
            {standorte.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm py-1 border-b border-[var(--border)] last:border-0">
                <span>{s.name}</span>
                <span className={`badge ${(freiMap.get(s.id) ?? 0) > 0 ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/50 dark:text-brand-200' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'}`}>
                  {freiMap.get(s.id) ?? 0} frei
                </span>
              </div>
            ))}
            {standorte.length === 0 && <p className="text-sm text-muted">Keine Standorte angelegt.</p>}
          </div>
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
            {neuListe.length === 0 && <p className="text-sm text-muted">Keine neuen Einträge in den letzten 7 Tagen.</p>}
          </div>
        </section>

        {/* Letzte Aktivitäten */}
        <section className="card p-5">
          <h2 className="font-semibold mb-3">Letzte Aktivitäten</h2>
          <div className="space-y-2">
            {letzteAktivitaeten.map((a) => (
              <div key={a.id} className="flex items-start gap-2 text-sm">
                {a.kuerzel && <span className="kuerzel">{a.kuerzel}</span>}
                <div className="min-w-0">
                  <p className="truncate">{a.aktion} · {a.entitaet}{a.details ? ` – ${a.details}` : ''}</p>
                  <p className="text-xs text-muted">{fmtDateTime(a.zeitpunkt)}</p>
                </div>
              </div>
            ))}
            {letzteAktivitaeten.length === 0 && <p className="text-sm text-muted">Noch keine Aktivitäten.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
