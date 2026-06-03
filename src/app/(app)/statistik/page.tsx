import { prisma } from '@/lib/prisma';
import { STATUS_LABEL, PFLEGEGRAD_LABEL } from '@/lib/labels';

export const dynamic = 'force-dynamic';

function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={`text-3xl font-semibold mt-1 ${accent ?? ''}`}>{value}</p>
    </div>
  );
}

export default async function StatistikPage() {
  const inaktiveStatus = ['EINGEZOGEN', 'ABGELEHNT', 'ARCHIVIERT'];
  const now = new Date();

  const [
    gesamt, aktiv, eingezogen, abgelehnt,
    neueLetzte30, neueLetzte7,
    nachStatus, nachPflegegrad, nachStandort,
    langeWartezeit, ueberfaellig,
    aktiveInteressenten,
  ] = await Promise.all([
    prisma.interessent.count(),
    prisma.interessent.count({ where: { status: { notIn: inaktiveStatus as never[] } } }),
    prisma.interessent.count({ where: { status: 'EINGEZOGEN' } }),
    prisma.interessent.count({ where: { status: 'ABGELEHNT' } }),
    prisma.interessent.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } } }),
    prisma.interessent.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
    prisma.interessent.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { _count: { status: 'desc' } } }),
    prisma.interessent.groupBy({ by: ['pflegegrad'], _count: { _all: true }, orderBy: { _count: { pflegegrad: 'desc' } } }),
    prisma.interessent.groupBy({
      by: ['standortId'],
      _count: { _all: true },
      orderBy: { _count: { standortId: 'desc' } },
      take: 5,
      where: { standortId: { not: null } },
    }),
    prisma.interessent.count({
      where: {
        createdAt: { lte: new Date(Date.now() - 90 * 86400000) },
        status: { notIn: inaktiveStatus as never[] },
      },
    }),
    prisma.interessent.count({
      where: {
        rueckmeldungBis: { lt: now },
        status: { notIn: inaktiveStatus as never[] },
      },
    }),
    prisma.interessent.findMany({
      where: { status: { notIn: inaktiveStatus as never[] } },
      select: { createdAt: true },
    }),
  ]);

  // Durchschnittliche Wartezeit aktiver Interessenten
  let durchschnittWartezeit = 0;
  if (aktiveInteressenten.length > 0) {
    const sumTage = aktiveInteressenten.reduce((acc, i) => {
      return acc + Math.floor((now.getTime() - new Date(i.createdAt).getTime()) / 86400000);
    }, 0);
    durchschnittWartezeit = Math.round(sumTage / aktiveInteressenten.length);
  }

  // Standortnamen nachschlagen
  const standortIds = nachStandort.map((s) => s.standortId).filter(Boolean) as string[];
  const standorte = standortIds.length
    ? await prisma.standort.findMany({ where: { id: { in: standortIds } }, select: { id: true, name: true } })
    : [];
  const standortMap = new Map(standorte.map((s) => [s.id, s.name]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Statistik</h1>

      {(langeWartezeit > 0 || ueberfaellig > 0) && (
        <div className="space-y-2">
          {langeWartezeit > 0 && (
            <div className="rounded-xl bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 px-4 py-3 text-red-800 dark:text-red-200 text-sm font-medium">
              ⚠ {langeWartezeit} {langeWartezeit === 1 ? 'Person wartet' : 'Personen warten'} länger als 3 Monate
            </div>
          )}
          {ueberfaellig > 0 && (
            <div className="rounded-xl bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-800 px-4 py-3 text-orange-800 dark:text-orange-200 text-sm font-medium">
              ⏰ {ueberfaellig} {ueberfaellig === 1 ? 'Rückmeldung überfällig' : 'Rückmeldungen überfällig'}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Gesamt" value={gesamt} />
        <StatCard label="Aktiv auf Liste" value={aktiv} accent="text-brand-600" />
        <StatCard label="Eingezogen" value={eingezogen} accent="text-green-600" />
        <StatCard label="Abgelehnt" value={abgelehnt} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Neue in letzten 7 Tagen</p>
            <p className="text-2xl font-semibold">{neueLetzte7}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted">Neue in letzten 30 Tagen</p>
            <p className="text-2xl font-semibold">{neueLetzte30}</p>
          </div>
        </div>
        <div className="card p-4">
          <p className="text-sm text-muted">Ø Wartezeit aktiver Interessenten</p>
          <p className="text-2xl font-semibold">
            {durchschnittWartezeit < 30
              ? `${durchschnittWartezeit} Tage`
              : durchschnittWartezeit < 365
              ? `${Math.floor(durchschnittWartezeit / 30)} Monate`
              : `${Math.floor(durchschnittWartezeit / 365)} J. ${Math.floor((durchschnittWartezeit % 365) / 30)} M.`}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <section className="card p-5">
          <h2 className="font-semibold mb-3">Nach Status</h2>
          <table className="w-full text-sm">
            <tbody>
              {nachStatus.map((row) => (
                <tr key={row.status} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2">{STATUS_LABEL[row.status as keyof typeof STATUS_LABEL] ?? row.status}</td>
                  <td className="py-2 text-right font-semibold">{row._count._all}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold mb-3">Nach Pflegegrad</h2>
          <table className="w-full text-sm">
            <tbody>
              {nachPflegegrad.map((row) => (
                <tr key={row.pflegegrad} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2">{PFLEGEGRAD_LABEL[row.pflegegrad as keyof typeof PFLEGEGRAD_LABEL] ?? row.pflegegrad}</td>
                  <td className="py-2 text-right font-semibold">{row._count._all}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold mb-3">Top 5 Standorte</h2>
          <table className="w-full text-sm">
            <tbody>
              {nachStandort.map((row) => (
                <tr key={row.standortId ?? 'null'} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2">{standortMap.get(row.standortId ?? '') ?? '–'}</td>
                  <td className="py-2 text-right font-semibold">{row._count._all}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
