import { requireUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { inaktivMinuten } from '@/lib/inaktiv';
import Nav from '@/components/Nav';
import InaktivWaechter from '@/components/InaktivWaechter';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="md:flex min-h-screen">
      <Nav
        user={user}
        canUsers={can(user, 'user.manage')}
        canStandorte={can(user, 'standort.manage')}
        canEinstellungen={can(user, 'user.manage')}
      />
      {/* Automatische Abmeldung nach Inaktivitaet; die Dauer kommt vom Server (INAKTIV_MINUTEN) */}
      <InaktivWaechter minuten={inaktivMinuten()} />
      <main className="flex-1 min-w-0 p-4 md:p-8 max-w-full w-full overflow-x-auto">{children}</main>
    </div>
  );
}
