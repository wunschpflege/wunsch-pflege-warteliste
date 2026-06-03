import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { can, getMatrix, ALL_PERMISSIONS, PERMISSION_LABEL } from '@/lib/rbac';
import { saveMatrix } from './actions';
import EinstellungenForm from './form';

export const dynamic = 'force-dynamic';

export default async function EinstellungenPage() {
  const user = await getSession();
  if (!can(user, 'user.manage')) redirect('/dashboard');

  const matrix = await getMatrix();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Einstellungen</h1>

      <section className="card p-6">
        <h2 className="font-semibold mb-1">Rollen & Berechtigungen</h2>
        <p className="text-sm text-muted mb-5">
          Lege fest welche Rolle welche Aktionen ausführen darf.
          Die Geschäftsführung hat immer Vollzugriff und kann nicht eingeschränkt werden.
        </p>
        <EinstellungenForm
          action={saveMatrix}
          matrix={matrix as { PDL: string[]; VERWALTUNG: string[] }}
          permissions={ALL_PERMISSIONS}
          permissionLabels={PERMISSION_LABEL}
        />
      </section>

      <section className="card p-6">
        <h2 className="font-semibold mb-4">System-Info</h2>
        <div className="grid sm:grid-cols-2 gap-x-8 text-sm">
          {[
            ['Version', '1.0.0'],
            ['Session-Gültigkeit', '8 Stunden'],
            ['Login-Schutz', 'Max. 5 Versuche / 15 Min.'],
            ['Auth-Methode', 'Benutzername + 4-stellige PIN'],
            ['Datenverschlüsselung', 'bcrypt (12 Rounds)'],
            ['Audit-Trail', 'Vollständig aktiv'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between py-2.5 border-b border-[var(--border)]">
              <span className="text-muted">{label}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
