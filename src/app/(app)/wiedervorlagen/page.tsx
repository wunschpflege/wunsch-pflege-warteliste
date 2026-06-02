import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { toggleWiedervorlage } from '../warteliste/actions';
import WiedervorlageForm from '@/components/WiedervorlageForm';
import { WV_TYP_LABEL, fmtDate } from '@/lib/labels';

export const dynamic = 'force-dynamic';

export default async function WiedervorlagenPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const sp = await searchParams;
  const user = await getSession();
  if (!can(user, 'wiedervorlage.manage')) redirect('/dashboard');

  const showDone = sp.filter === 'erledigt';
  const items = await prisma.wiedervorlage.findMany({
    where: { erledigt: showDone },
    include: { interessent: true, zustaendig: true },
    orderBy: { faelligAm: 'asc' },
    take: 200,
  });

  const now = new Date();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Wiedervorlagen & Erinnerungen</h1>

      <section className="card p-5">
        <h2 className="font-semibold mb-3">Neue Wiedervorlage</h2>
        <WiedervorlageForm />
      </section>

      <div className="flex gap-2">
        <Link href="/wiedervorlagen" className={!showDone ? 'btn-primary' : 'btn-ghost'}>Offen</Link>
        <Link href="/wiedervorlagen?filter=erledigt" className={showDone ? 'btn-primary' : 'btn-ghost'}>Erledigt</Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-[var(--border)]">
            <tr>
              <th className="th"></th><th className="th">Titel</th><th className="th">Typ</th>
              <th className="th">Interessent</th><th className="th">Fällig</th><th className="th">Zuständig</th>
            </tr>
          </thead>
          <tbody>
            {items.map((w) => {
              const overdue = !w.erledigt && new Date(w.faelligAm) < now;
              return (
                <tr key={w.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="td">
                    <form action={toggleWiedervorlage.bind(null, w.id)}>
                      <button title={w.erledigt ? 'Wieder öffnen' : 'Als erledigt markieren'} className="h-5 w-5 rounded border border-[var(--border)] grid place-items-center">
                        {w.erledigt ? '✓' : ''}
                      </button>
                    </form>
                  </td>
                  <td className="td">
                    <span className={w.erledigt ? 'line-through text-muted' : 'font-medium'}>{w.titel}</span>
                    {w.notiz && <p className="text-xs text-muted">{w.notiz}</p>}
                  </td>
                  <td className="td">{WV_TYP_LABEL[w.typ]}</td>
                  <td className="td">
                    {w.interessent
                      ? <Link href={`/warteliste/${w.interessent.id}`} className="text-brand-600 hover:underline">{w.interessent.vorname} {w.interessent.nachname}</Link>
                      : '–'}
                  </td>
                  <td className="td whitespace-nowrap">
                    <span className={overdue ? 'text-red-600 font-medium' : ''}>{fmtDate(w.faelligAm)}</span>
                  </td>
                  <td className="td"><span className="kuerzel">{w.kuerzel}</span></td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr><td colSpan={6} className="td text-center text-muted py-8">Keine {showDone ? 'erledigten' : 'offenen'} Wiedervorlagen.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
