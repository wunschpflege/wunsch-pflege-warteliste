import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import InteressentForm from '@/components/InteressentForm';
import { createInteressent } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NeuPage() {
  const user = await getSession();
  if (!can(user, 'interessent.create')) redirect('/warteliste');
  const standorte = await prisma.standort.findMany({ where: { aktiv: true }, orderBy: { name: 'asc' } });

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-muted">
        <Link href="/warteliste" className="hover:underline">Warteliste</Link>
        <span>/</span><span>Neuer Interessent</span>
      </div>
      <h1 className="text-2xl font-semibold">Neuer Interessent</h1>
      <InteressentForm action={createInteressent} standorte={standorte} submitLabel="Anlegen" />
    </div>
  );
}
