import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { redirect } from 'next/navigation';
import { fmtDate } from '@/lib/labels';

export const dynamic = 'force-dynamic';

const GRUND_LABEL: Record<string, string> = {
  VERSTORBEN: 'Verstorben',
  AUSGEZOGEN: 'Ausgezogen',
  UMGEZOGEN:  'Umgezogen',
};

const GRUND_COLOR: Record<string, string> = {
  VERSTORBEN: 'bg-gray-200 text-gray-700',
  AUSGEZOGEN: 'bg-blue-100 text-blue-700',
  UMGEZOGEN:  'bg-amber-100 text-amber-700',
};

export default async function ArchivPage() {
  const user = await getSession();
  if (!can(user, 'platz.manage')) redirect('/dashboard');

  const eintraege = await (prisma as any).bewohnerArchiv.findMany({
    include: { standort: true },
    orderBy: { auszugAm: 'desc' },
    take: 500,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Archiv – ehemalige Bewohner</h1>
        <p className="text-sm text-muted">{eintraege.length} Einträge</p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-[var(--border)]">
              <th className="th py-3">Name</th>
              <th className="th py-3">Einrichtung / WG</th>
              <th className="th py-3">Eingezogen am</th>
              <th className="th py-3">Abgemeldet am</th>
              <th className="th py-3">Grund</th>
              <th className="th py-3">Bemerkung</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {eintraege.map((e: any) => (
              <tr key={e.id} className="hover:bg-gray-50/70 transition-colors">
                <td className="td py-3 font-medium">{e.bewohnerName}</td>
                <td className="td py-3">{e.standort.name}</td>
                <td className="td py-3 text-muted">
                  {e.belegtSeit ? fmtDate(new Date(e.belegtSeit)) : '–'}
                </td>
                <td className="td py-3">{fmtDate(new Date(e.auszugAm))}</td>
                <td className="td py-3">
                  <span className={`badge ${GRUND_COLOR[e.auszugGrund] ?? 'bg-gray-100 text-gray-600'}`}>
                    {GRUND_LABEL[e.auszugGrund] ?? e.auszugGrund}
                  </span>
                </td>
                <td className="td py-3 text-muted max-w-xs">
                  {e.bemerkung ?? '–'}
                </td>
              </tr>
            ))}
            {eintraege.length === 0 && (
              <tr>
                <td colSpan={6} className="td text-center text-muted py-10">
                  Noch keine archivierten Bewohner.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
