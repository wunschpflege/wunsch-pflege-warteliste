import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { fmtDate } from '@/lib/labels';
import { platzFreigeben, platzBelegen, platzAnlegen, platzLoeschen } from './actions';

export const dynamic = 'force-dynamic';

export default async function PlaetzePage() {
  const user = await getSession();
  const canManage = can(user, 'platz.manage');

  const [standorte, plaetze] = await Promise.all([
    prisma.standort.findMany({ where: { aktiv: true }, orderBy: { name: 'asc' } }),
    prisma.platz.findMany({ include: { standort: true }, orderBy: [{ standort: { name: 'asc' } }, { zimmernummer: 'asc' }] }),
  ]);

  // Group by standortId
  const grouped = new Map<string, typeof plaetze>();
  for (const p of plaetze) {
    const arr = grouped.get(p.standortId) ?? [];
    arr.push(p);
    grouped.set(p.standortId, arr);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Freie Plätze</h1>
      </div>

      {canManage && (
        <section className="card p-5">
          <h2 className="font-semibold mb-4">Neues Zimmer erfassen</h2>
          <form action={platzAnlegen} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="label">Einrichtung *</label>
              <select name="standortId" className="select" required>
                <option value="">– wählen –</option>
                {standorte.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Zimmer-Bezeichnung (optional)</label>
              <input name="zimmernummer" className="input" placeholder="z. B. EG links" />
            </div>
            <div>
              <label className="label">Aktueller Bewohner</label>
              <input name="bewohnerName" className="input" placeholder="z. B. Frau Meier" />
            </div>
            <div>
              <label className="label">Bewohnt seit</label>
              <input type="date" name="belegtSeit" className="input" />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <button type="submit" className="btn-primary">Zimmer anlegen</button>
            </div>
          </form>
        </section>
      )}

      {standorte.map((s) => {
        const zimmer = grouped.get(s.id) ?? [];
        const freiCount = zimmer.filter((z) => !z.belegt).length;
        return (
          <section key={s.id} className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">{s.name}</h2>
              <span className={`badge ${freiCount > 0 ? 'bg-brand-100 text-brand-800' : 'bg-gray-100 text-gray-500'}`}>
                {freiCount} frei / {zimmer.length} gesamt
              </span>
            </div>
            {zimmer.length === 0 && <p className="text-sm text-muted">Noch keine Zimmer erfasst.</p>}
            <div className="space-y-2">
              {zimmer.map((z) => (
                <div key={z.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm ${z.belegt ? 'bg-gray-50 border border-[var(--border)]' : 'bg-green-50 border border-green-200'}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${z.belegt ? 'bg-gray-400' : 'bg-green-500'}`} />
                    <div>
                      {(z as any).bewohnerName
                        ? <p className="font-medium">{(z as any).bewohnerName}</p>
                        : <p className="text-muted italic">Frei</p>}
                      {z.zimmernummer && z.zimmernummer !== '-' && <p className="text-xs text-muted">{z.zimmernummer}</p>}
                      {(z as any).belegtSeit && <p className="text-xs text-muted">Bewohnt seit {fmtDate((z as any).belegtSeit)}</p>}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {z.belegt ? (
                        <form action={platzFreigeben.bind(null, z.id)}>
                          <button type="submit" className="btn-ghost text-sm text-orange-700 border-orange-300 hover:bg-orange-50">
                            Verstorben / ausgezogen
                          </button>
                        </form>
                      ) : (
                        <form action={platzBelegen.bind(null, z.id)} className="flex items-center gap-2">
                          <input name="bewohnerName" className="input text-sm py-1 w-36" placeholder="Bewohnername" required />
                          <input type="date" name="belegtSeit" className="input text-sm py-1" />
                          <button type="submit" className="btn-primary text-sm">Belegen</button>
                        </form>
                      )}
                      <form action={platzLoeschen.bind(null, z.id)}>
                        <button type="submit" className="btn-danger text-xs px-2 py-1">Löschen</button>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
      {standorte.length === 0 && <p className="text-sm text-muted card p-5">Noch keine Einrichtungen angelegt.</p>}
    </div>
  );
}
