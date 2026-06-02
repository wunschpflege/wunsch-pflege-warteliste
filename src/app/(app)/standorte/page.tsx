import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { saveStandort, toggleStandort } from './actions';
import StandortFormClient from './form';

export const dynamic = 'force-dynamic';

export default async function StandortePage() {
  const user = await getSession();
  if (!can(user, 'standort.manage')) redirect('/dashboard');

  const standorte = await prisma.standort.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { interessenten: true, plaetze: true } } },
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Standorte</h1>

      <StandortFormClient action={saveStandort.bind(null, null)} title="Neuen Standort anlegen" submitLabel="Anlegen" />

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-[var(--border)]">
            <tr>
              <th className="th">Name</th><th className="th">Adresse</th>
              <th className="th">Interessenten</th><th className="th">Plätze</th>
              <th className="th">Status</th><th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {standorte.map((s) => (
              <tr key={s.id} className="border-b border-[var(--border)] last:border-0">
                <td className="td font-medium">{s.name}</td>
                <td className="td">{s.adresse ?? '–'}</td>
                <td className="td">{s._count.interessenten}</td>
                <td className="td">{s._count.plaetze}</td>
                <td className="td">
                  <span className={`badge ${s.aktiv ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200' : 'bg-gray-200 text-gray-600 dark:bg-gray-700'}`}>
                    {s.aktiv ? 'aktiv' : 'inaktiv'}
                  </span>
                </td>
                <td className="td">
                  <form action={toggleStandort.bind(null, s.id)}>
                    <button className="text-sm text-brand-600 hover:underline">{s.aktiv ? 'Deaktivieren' : 'Aktivieren'}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
