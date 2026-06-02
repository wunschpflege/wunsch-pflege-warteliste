import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can, ROLE_LABEL } from '@/lib/rbac';
import { fmtDateTime } from '@/lib/labels';
import { saveUser, toggleUserAktiv } from './actions';
import UserFormClient from './form';

export const dynamic = 'force-dynamic';

export default async function BenutzerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await getSession();
  if (!can(user, 'user.manage')) redirect('/dashboard');

  const sp = await searchParams;
  const editId = sp.edit ?? null;

  const users = await prisma.user.findMany({
    orderBy: [{ aktiv: 'desc' }, { nachname: 'asc' }],
  });

  const editUser = editId ? users.find((u) => u.id === editId) ?? null : null;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Benutzerverwaltung</h1>

      {editUser ? (
        <UserFormClient
          action={saveUser.bind(null, editUser.id)}
          title={`Benutzer bearbeiten – ${editUser.vorname} ${editUser.nachname} (${editUser.kuerzel})`}
          submitLabel="Änderungen speichern"
          isEdit
          defaults={{
            vorname: editUser.vorname,
            nachname: editUser.nachname,
            username: editUser.username,
            role: editUser.role,
          }}
        />
      ) : (
        <UserFormClient
          action={saveUser.bind(null, null)}
          title="Neuen Benutzer anlegen"
          submitLabel="Anlegen"
          resetOnSuccess
        />
      )}

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-[var(--border)]">
            <tr>
              <th className="th">Kürzel</th>
              <th className="th">Name</th>
              <th className="th">Benutzername</th>
              <th className="th">Rolle</th>
              <th className="th">Letzter Login</th>
              <th className="th">Status</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-[var(--border)] last:border-0">
                <td className="td"><span className="kuerzel">{u.kuerzel}</span></td>
                <td className="td font-medium">{u.nachname}, {u.vorname}</td>
                <td className="td font-mono text-sm">{u.username}</td>
                <td className="td">{ROLE_LABEL[u.role]}</td>
                <td className="td whitespace-nowrap">{u.letzterLogin ? fmtDateTime(u.letzterLogin) : '–'}</td>
                <td className="td">
                  <span className={`badge ${u.aktiv ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200' : 'bg-gray-200 text-gray-600 dark:bg-gray-700'}`}>
                    {u.aktiv ? 'aktiv' : 'inaktiv'}
                  </span>
                </td>
                <td className="td">
                  <div className="flex items-center gap-3">
                    <a href={`/benutzer?edit=${u.id}`} className="text-sm text-brand-600 hover:underline">Bearbeiten</a>
                    {u.id !== user!.id && (
                      <form action={toggleUserAktiv.bind(null, u.id)}>
                        <button className="text-sm text-brand-600 hover:underline">
                          {u.aktiv ? 'Deaktivieren' : 'Aktivieren'}
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
