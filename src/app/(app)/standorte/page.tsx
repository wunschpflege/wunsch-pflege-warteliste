import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { saveStandort, toggleStandort, deleteStandort } from './actions';
import StandortFormClient from './form';

export const dynamic = 'force-dynamic';

export default async function StandortePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await getSession();
  if (!can(user, 'standort.manage')) redirect('/dashboard');

  const sp = await searchParams;
  const editId = sp.edit ?? null;

  const standorte = await prisma.standort.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { interessenten: true, plaetze: true } } },
  });

  const editStandort = editId ? standorte.find((s) => s.id === editId) ?? null : null;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Standorte</h1>

      {editStandort ? (
        <StandortFormClient
          action={saveStandort.bind(null, editStandort.id)}
          title={`Standort bearbeiten – ${editStandort.name}`}
          submitLabel="Änderungen speichern"
          defaults={{
            name: editStandort.name,
            strasse: editStandort.strasse ?? '',
            hausnummer: editStandort.hausnummer ?? '',
            plz: editStandort.plz ?? '',
            bemerkungen: editStandort.bemerkungen ?? '',
            aktiv: editStandort.aktiv,
          }}
        />
      ) : (
        <StandortFormClient
          action={saveStandort.bind(null, null)}
          title="Neuen Standort anlegen"
          submitLabel="Anlegen"
        />
      )}

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-[var(--border)]">
            <tr>
              <th className="th">Name</th>
              <th className="th">Adresse</th>
              <th className="th">Interessenten</th>
              <th className="th">Plätze</th>
              <th className="th">Status</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {standorte.map((s) => {
              const adresse = [s.strasse, s.hausnummer, s.plz].filter(Boolean).join(' ');
              return (
                <tr key={s.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="td font-medium">{s.name}</td>
                  <td className="td">{adresse || '–'}</td>
                  <td className="td">{s._count.interessenten}</td>
                  <td className="td">{s._count.plaetze}</td>
                  <td className="td">
                    <span className={`badge ${s.aktiv ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                      {s.aktiv ? 'aktiv' : 'inaktiv'}
                    </span>
                  </td>
                  <td className="td">
                    <div className="flex items-center gap-3 flex-wrap">
                      <a href={`/standorte?edit=${s.id}`} className="text-sm text-brand-600 hover:underline">
                        Bearbeiten
                      </a>
                      <form action={toggleStandort.bind(null, s.id)}>
                        <button className="text-sm text-brand-600 hover:underline">
                          {s.aktiv ? 'Deaktivieren' : 'Aktivieren'}
                        </button>
                      </form>
                      <form action={deleteStandort.bind(null, s.id)}>
                        <button
                          className="btn-danger text-xs px-2 py-1"
                          disabled={s._count.interessenten > 0}
                          title={s._count.interessenten > 0 ? 'Hat zugeordnete Interessenten – nicht löschbar' : 'Standort löschen'}
                        >
                          Löschen
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {standorte.length === 0 && (
              <tr><td colSpan={6} className="td text-center text-muted py-8">Keine Standorte vorhanden.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
