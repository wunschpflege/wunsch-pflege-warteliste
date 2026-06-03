import { requireUser } from '@/lib/auth';
import { ROLE_LABEL } from '@/lib/rbac';
import PinForm from './form';

export const dynamic = 'force-dynamic';

export default async function ProfilPage() {
  const user = await requireUser();

  return (
    <div className="space-y-5 max-w-lg">
      <h1 className="text-2xl font-semibold">Mein Profil</h1>

      <section className="card p-5 space-y-3">
        <h2 className="font-semibold">Benutzerinformationen</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted">Benutzername</p>
            <p className="font-medium">{user.username}</p>
          </div>
          <div>
            <p className="text-muted">Kürzel</p>
            <span className="kuerzel">{user.kuerzel}</span>
          </div>
          <div>
            <p className="text-muted">Name</p>
            <p className="font-medium">{user.vorname} {user.nachname}</p>
          </div>
          <div>
            <p className="text-muted">Rolle</p>
            <p className="font-medium">{ROLE_LABEL[user.role]}</p>
          </div>
        </div>
      </section>

      <section className="card p-5 space-y-4">
        <h2 className="font-semibold">PIN ändern</h2>
        <PinForm />
      </section>
    </div>
  );
}
