import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import InteressentForm from '@/components/InteressentForm';
import WiedervorlageForm from '@/components/WiedervorlageForm';
import DeleteButton from '@/components/DeleteButton';
import { updateInteressent, deleteInteressent } from '../actions';
import { fmtDateTime, WV_TYP_LABEL, STATUS_LABEL, STATUS_COLOR, fmtDate } from '@/lib/labels';

export const dynamic = 'force-dynamic';

export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSession();
  if (!can(user, 'interessent.read')) redirect('/dashboard');

  const i = await prisma.interessent.findUnique({
    where: { id },
    include: {
      standort: true,
      erstelltVon: true,
      historie: { orderBy: { zeitpunkt: 'desc' } },
      wiedervorlagen: { orderBy: { faelligAm: 'asc' } },
      wunschStandorte: { select: { id: true } },
    },
  });
  if (!i) notFound();

  const standorte = await prisma.standort.findMany({ where: { aktiv: true }, orderBy: { name: 'asc' } });
  const editable = can(user, 'interessent.update');
  const boundUpdate = updateInteressent.bind(null, i.id);
  const boundDelete = deleteInteressent.bind(null, i.id);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted">
        <Link href="/warteliste" className="hover:underline">Warteliste</Link>
        <span>/</span><span>{i.nachname}, {i.vorname}</span>
      </div>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{i.vorname} {i.nachname}</h1>
          <p className="text-sm text-muted">
            Angelegt am {fmtDate(i.createdAt)} von <span className="kuerzel">{i.erstelltVon.kuerzel}</span> {i.erstelltVon.vorname} {i.erstelltVon.nachname}
          </p>
        </div>
        <span className={`badge ${STATUS_COLOR[i.status]} text-sm`}>{STATUS_LABEL[i.status]}</span>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {editable ? (
            <InteressentForm action={boundUpdate} standorte={standorte} data={i} wunschStandorteIds={i.wunschStandorte.map(s => s.id)} submitLabel="Änderungen speichern" />
          ) : (
            <div className="card p-5 text-sm text-muted">Sie haben keine Berechtigung zum Bearbeiten.</div>
          )}

          {can(user, 'interessent.delete') && (
            <div className="card p-5 border-red-200 dark:border-red-900/50">
              <h3 className="font-semibold text-red-600 mb-2">Datensatz löschen</h3>
              <DeleteButton action={boundDelete} />
            </div>
          )}
        </div>

        <div className="space-y-5">
          {/* Wiedervorlagen */}
          <section className="card p-5">
            <h2 className="font-semibold mb-3">Wiedervorlagen</h2>
            <div className="space-y-2 mb-4">
              {i.wiedervorlagen.map((w) => (
                <div key={w.id} className="text-sm border-b border-[var(--border)] pb-2 last:border-0">
                  <p className={`font-medium ${w.erledigt ? 'line-through text-muted' : ''}`}>{w.titel}</p>
                  <p className="text-xs text-muted">{WV_TYP_LABEL[w.typ]} · {fmtDate(w.faelligAm)} · {w.kuerzel}</p>
                </div>
              ))}
              {i.wiedervorlagen.length === 0 && <p className="text-sm text-muted">Keine Wiedervorlagen.</p>}
            </div>
            {can(user, 'wiedervorlage.manage') && <WiedervorlageForm interessentId={i.id} compact />}
          </section>

          {/* Historie */}
          <section className="card p-5">
            <h2 className="font-semibold mb-3">Historie</h2>
            <ol className="space-y-3">
              {i.historie.map((h) => (
                <li key={h.id} className="flex gap-3 text-sm">
                  <span className="kuerzel mt-0.5">{h.kuerzel}</span>
                  <div>
                    <p>{h.aktion}</p>
                    {h.feld && h.altWert != null && (
                      <p className="text-xs text-muted">{h.altWert} → {h.neuWert}</p>
                    )}
                    <p className="text-xs text-muted">{fmtDateTime(h.zeitpunkt)} · {h.mitarbeiter}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
