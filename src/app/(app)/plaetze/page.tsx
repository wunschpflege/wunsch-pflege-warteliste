import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { matchKandidaten } from '@/lib/matching';
import { savePlatz, togglePlatzBelegt, deletePlatz } from './actions';
import PlatzFormClient from './form';
import { GESCHLECHT_LABEL, PFLEGEGRAD_LABEL, fmtDate, STATUS_LABEL } from '@/lib/labels';

export const dynamic = 'force-dynamic';

export default async function PlaetzePage() {
  const user = await getSession();
  if (!can(user, 'platz.manage')) redirect('/dashboard');

  const [plaetze, standorte] = await Promise.all([
    prisma.platz.findMany({ include: { standort: true }, orderBy: [{ belegt: 'asc' }, { freiAb: 'asc' }] }),
    prisma.standort.findMany({ where: { aktiv: true }, orderBy: { name: 'asc' } }),
  ]);

  // Matching nur fuer freie Plaetze berechnen
  const freie = plaetze.filter((p) => !p.belegt);
  const matches = await Promise.all(freie.map((p) => matchKandidaten(p)));
  const matchMap = new Map(freie.map((p, idx) => [p.id, matches[idx]]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Freie Plätze</h1>

      <PlatzFormClient action={savePlatz.bind(null, null)} standorte={standorte} />

      <div className="space-y-4">
        {plaetze.map((p) => {
          const ms = matchMap.get(p.id) ?? [];
          return (
            <div key={p.id} className="card p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold">
                    {p.standort.name} · Zimmer {p.zimmernummer}
                    {p.belegt
                      ? <span className="badge ml-2 bg-gray-200 text-gray-600 dark:bg-gray-700">belegt</span>
                      : <span className="badge ml-2 bg-brand-100 text-brand-800">frei</span>}
                  </p>
                  <p className="text-sm text-muted">
                    Frei ab {fmtDate(p.freiAb)} · Bevorzugt: {GESCHLECHT_LABEL[p.geschlechtPref]}
                    {p.bemerkungen ? ` · ${p.bemerkungen}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={togglePlatzBelegt.bind(null, p.id)}>
                    <button className="btn-ghost text-sm">{p.belegt ? 'Als frei markieren' : 'Als belegt markieren'}</button>
                  </form>
                  <form action={deletePlatz.bind(null, p.id)}>
                    <button className="btn-danger text-sm">Löschen</button>
                  </form>
                </div>
              </div>

              {!p.belegt && (
                <div className="mt-4 border-t border-[var(--border)] pt-3">
                  <p className="text-sm font-medium mb-2">Vorgeschlagene Interessenten</p>
                  {ms.length === 0 && <p className="text-sm text-muted">Keine passenden Interessenten gefunden.</p>}
                  <div className="space-y-2">
                    {ms.slice(0, 5).map((m) => (
                      <Link
                        key={m.interessent.id}
                        href={`/warteliste/${m.interessent.id}`}
                        className="flex items-center justify-between text-sm rounded-lg px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 -mx-2"
                      >
                        <div>
                          <span className="font-medium text-brand-600">{m.interessent.vorname} {m.interessent.nachname}</span>
                          <span className="text-xs text-muted ml-2">
                            {PFLEGEGRAD_LABEL[m.interessent.pflegegrad]} · {STATUS_LABEL[m.interessent.status]}
                            {m.gruende.length ? ` · ${m.gruende.join(', ')}` : ''}
                          </span>
                        </div>
                        <span className="badge bg-brand-600 text-white">{m.score} Pkt.</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {plaetze.length === 0 && <p className="text-sm text-muted">Noch keine Plätze erfasst.</p>}
      </div>
    </div>
  );
}
