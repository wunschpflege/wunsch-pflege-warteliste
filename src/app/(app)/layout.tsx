import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import Nav from '@/components/Nav';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect('/login');

  return (
    <div className="md:flex min-h-screen">
      <Nav
        user={user}
        canUsers={can(user, 'user.manage')}
        canStandorte={can(user, 'standort.manage')}
      />
      <main className="flex-1 min-w-0 p-4 md:p-8 max-w-6xl mx-auto w-full">{children}</main>
    </div>
  );
}
