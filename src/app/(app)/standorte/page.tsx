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
  const neuOffen = sp.neu === '1';

  const standorte = await prisma.standort.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { interessenten: true, plaetze: true } } },
  });

  // Plätze-Belegungs-Zahlen pro Standort
  const plaetzeGruppiert = await prisma.platz.groupBy({
    by: ['standortId', 'belegt'],
    _count: { _all: true },
  });
  const platzMap = new Map<string, { frei: number; belegt: number }>();
  for (const p of plaetzeGruppiert) {
    const cur = platzMap.get(p.standortId) ?? { frei: 0, belegt: 0 };
    if (p.belegt) cur.belegt += p._count._all;
    else cur.frei += p._count._all;
    platzMap.set(p.standortId, cur);
  }

  const editStandort = editId ? standorte.find((s) => s.id === editId) ?? null : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Standorte</h1>
      </div>

      {/* Bearbeiten-Formular (wenn edit-Param gesetzt) */}
      {editStandort && (
        <StandortFormClient
          action={saveStandort.bind(null, editStandort.id)}
          title={`Standort bearbeiten – ${editStandort.name}`}
          submitLabel="Änderungen speichern"
          defaults={{
            name: editStandort.name,
            strasse: editStandort.strasse ?? '',
            hausnummer: editStandort.hausnummer ?? '',
            plz: editStandort.plz ?? '',
            ort: editStandort.ort ?? '',
            bemerkungen: editStandort.bemerkungen ?? '',
            gesamtplaetze: (editStandort as any).gesamtplaetze ?? null,
            aktiv: editStandort.aktiv,
          }}
        />
      )}

      {/* Neuen Standort anlegen – Accordion */}
      {!editStandort && (
        <details open={neuOffen} className="group card overflow-hidden">
          <summary className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors list-none">
            <div className="flex items-center gap-3">
              <span className="h-8 w-8 rounded-lg bg-brand-100 text-brand-700 grid place-items-center text-lg font-bold">+</span>
              <span className="font-semibold">Neuen Standort anlegen</span>
            </div>
            <svg className="h-4 w-4 text-muted transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="border-t border-[var(--border)] px-5 pb-5 pt-4">
            <StandortFormClient
              action={saveStandort.bind(null, null)}
              title=""
              submitLabel="Anlegen"
            />
          </div>
        </details>
      )}

      {/* Standort-Liste */}
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
              const pz = platzMap.get(s.id) ?? { frei: 0, belegt: 0 };
              const gesamt = pz.frei + pz.belegt;
              return (
                <tr key={s.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="td font-medium">{s.name}</td>
                  <td className="td">
                    {(s.strasse || s.hausnummer || s.plz || s.ort) ? (
                      <div className="text-sm leading-snug">
                        {(s.strasse || s.hausnummer) && (
                          <p>{[s.strasse, s.hausnummer].filter(Boolean).join(' ')}</p>
                        )}
                        {(s.plz || s.ort) && (
                          <p className="text-muted">{[s.plz, s.ort].filter(Boolean).join(' ')}</p>
                        )}
                      </div>
                    ) : <span className="text-muted">–</span>}
                  </td>
                  <td className="td">{s._count.interessenten}</td>
                  <td className="td">
                    <div className="text-sm space-y-0.5">
                      {(s as any).gesamtplaetze != null && (
                        <p className="font-medium">{(s as any).gesamtplaetze} Plätze gesamt</p>
                      )}
                      {gesamt > 0 ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-green-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                            {pz.frei} frei
                          </span>
                          <span className="text-muted">·</span>
                          <span className="inline-flex items-center gap-1 text-gray-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-gray-400 inline-block" />
                            {pz.belegt} belegt
                          </span>
                        </div>
                      ) : (s as any).gesamtplaetze == null ? (
                        <span className="text-muted">–</span>
                      ) : null}
                    </div>
                  </td>
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
