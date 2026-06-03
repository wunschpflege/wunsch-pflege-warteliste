import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import {
  STATUS_LABEL, STATUS_COLOR, PFLEGEGRAD_LABEL, PRIO_LABEL,
  GESCHLECHT_LABEL, WV_TYP_LABEL, fmtDate,
} from '@/lib/labels';
import type { Prisma } from '@prisma/client';

type InteressentMitRelationen = Prisma.InteressentGetPayload<{
  include: { standort: true; erstelltVon: true };
}>;

type PlatzMitStandort = Prisma.PlatzGetPayload<{
  include: { standort: true };
}>;

type WiedervorlageMitRelationen = Prisma.WiedervorlageGetPayload<{
  include: { interessent: true; zustaendig: true };
}>;
import { deleteInteressent, toggleWiedervorlage, deleteWiedervorlage } from './actions';
import { savePlatz, togglePlatzBelegt, deletePlatz } from '../plaetze/actions';
import PlatzFormClient from '../plaetze/form';
import WiedervorlageForm from '@/components/WiedervorlageForm';
import { matchKandidaten } from '@/lib/matching';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | undefined>;

export default async function WartelistePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await getSession();
  const tab = sp.tab ?? 'interessenten';
  const q = (sp.q ?? '').trim();
  const now = new Date();
  const in7 = new Date(Date.now() + 7 * 86_400_000);

  // Gemeinsame Daten
  const [standorte, mitarbeiter] = await Promise.all([
    prisma.standort.findMany({ where: { aktiv: true }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({ where: { aktiv: true }, orderBy: { nachname: 'asc' } }),
  ]);

  // ── Tab: Interessenten ──────────────────────────────────────────
  let eintraege: InteressentMitRelationen[] = [];
  if (tab === 'interessenten') {
    const where: Prisma.InteressentWhereInput = {};
    const and: Prisma.InteressentWhereInput[] = [];
    if (q) and.push({ OR: [
      { vorname: { contains: q, mode: 'insensitive' } },
      { nachname: { contains: q, mode: 'insensitive' } },
      { telefonFestnetz: { contains: q } },
      { telefonMobil: { contains: q } },
      { angehoerigerNachname: { contains: q, mode: 'insensitive' } },
      { angehoerigerVorname: { contains: q, mode: 'insensitive' } },
    ]});
    if (sp.standort)    and.push({ standortId: sp.standort });
    if (sp.status)      and.push({ status: sp.status as never });
    if (sp.pflegegrad)  and.push({ pflegegrad: sp.pflegegrad as never });
    if (sp.mitarbeiter) and.push({ erstelltVonId: sp.mitarbeiter });
    if (sp.von || sp.bis) and.push({ createdAt: {
      ...(sp.von ? { gte: new Date(sp.von) } : {}),
      ...(sp.bis ? { lte: new Date(sp.bis + 'T23:59:59') } : {}),
    }});
    if (and.length) where.AND = and;
    eintraege = await prisma.interessent.findMany({
      where,
      include: { standort: true, erstelltVon: true },
      orderBy: [{ prioritaet: 'desc' }, { createdAt: 'asc' }],
      take: 300,
    }) as InteressentMitRelationen[];
  }

  // ── Tab: Freie Plätze ──────────────────────────────────────────
  let plaetze: PlatzMitStandort[] = [];
  let matchMap = new Map<string, Awaited<ReturnType<typeof matchKandidaten>>>();
  if (tab === 'plaetze' && can(user, 'platz.manage')) {
    plaetze = await prisma.platz.findMany({
      include: { standort: true },
      orderBy: [{ belegt: 'asc' }, { freiAb: 'asc' }],
    });
    const freie = plaetze.filter((p) => !p.belegt);
    const matches = await Promise.all(freie.map((p) => matchKandidaten(p)));
    matchMap = new Map(freie.map((p, idx) => [p.id, matches[idx]]));
  }

  // ── Tab: Wiedervorlagen ────────────────────────────────────────
  let wiedervorlagen: WiedervorlageMitRelationen[] = [];
  if (tab === 'wiedervorlagen' && can(user, 'wiedervorlage.manage')) {
    const showDone = sp.wv === 'erledigt';
    wiedervorlagen = await prisma.wiedervorlage.findMany({
      where: { erledigt: showDone },
      include: { interessent: true, zustaendig: true },
      orderBy: { faelligAm: 'asc' },
      take: 200,
    });
  }

  const exportQs = new URLSearchParams(
    Object.entries(sp).filter(([k, v]) => v && k !== 'tab') as [string, string][],
  ).toString();

  const tabs = [
    { key: 'interessenten', label: 'Interessenten' },
    ...(can(user, 'platz.manage') ? [{ key: 'plaetze', label: 'Freie Plätze' }] : []),
    ...(can(user, 'wiedervorlage.manage') ? [{ key: 'wiedervorlagen', label: 'Wiedervorlagen' }] : []),
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Warteliste</h1>
        <div className="flex gap-2 flex-wrap">
          {tab === 'interessenten' && can(user, 'export') && (
            <>
              <a className="btn-ghost" href={`/api/export?format=csv&${exportQs}`}>CSV</a>
              <a className="btn-ghost" href={`/api/export?format=xlsx&${exportQs}`}>Excel</a>
              <a className="btn-ghost" href={`/api/export?format=pdf&${exportQs}`} target="_blank">PDF</a>
            </>
          )}
          {can(user, 'interessent.create') && (
            <Link href="/warteliste/neu" className="btn-primary">+ Neuer Interessent</Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/warteliste?tab=${t.key}`}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
              tab === t.key
                ? 'bg-brand-600 text-white'
                : 'text-muted hover:text-[var(--text)] hover:bg-[var(--border)]'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ── TAB: INTERESSENTEN ─────────────────────────────────── */}
      {tab === 'interessenten' && (
        <>
          <form className="card p-4 grid md:grid-cols-3 lg:grid-cols-4 gap-3" method="get">
            <input type="hidden" name="tab" value="interessenten" />
            <div className="lg:col-span-2">
              <label className="label">Suche (Name, Telefon, Angehörige)</label>
              <input name="q" defaultValue={q} className="input" placeholder="z. B. Müller oder 0231…" />
            </div>
            <div>
              <label className="label">Standort</label>
              <select name="standort" defaultValue={sp.standort ?? ''} className="select">
                <option value="">Alle</option>
                {standorte.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select name="status" defaultValue={sp.status ?? ''} className="select">
                <option value="">Alle</option>
                {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Pflegegrad</label>
              <select name="pflegegrad" defaultValue={sp.pflegegrad ?? ''} className="select">
                <option value="">Alle</option>
                {Object.entries(PFLEGEGRAD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Mitarbeiter</label>
              <select name="mitarbeiter" defaultValue={sp.mitarbeiter ?? ''} className="select">
                <option value="">Alle</option>
                {mitarbeiter.map((m) => <option key={m.id} value={m.id}>{m.kuerzel} – {m.vorname} {m.nachname}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Von</label>
              <input type="date" name="von" defaultValue={sp.von ?? ''} className="input" />
            </div>
            <div>
              <label className="label">Bis</label>
              <input type="date" name="bis" defaultValue={sp.bis ?? ''} className="input" />
            </div>
            <div className="flex items-end gap-2">
              <button className="btn-primary flex-1" type="submit">Filtern</button>
              <Link href="/warteliste?tab=interessenten" className="btn-ghost">Reset</Link>
            </div>
          </form>

          <p className="text-sm text-muted">{eintraege.length} Einträge</p>

          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-[var(--border)]">
                <tr>
                  <th className="th">Name</th>
                  <th className="th">Angehöriger</th>
                  <th className="th">Standort</th>
                  <th className="th">Pflegegrad</th>
                  <th className="th">Priorität</th>
                  <th className="th">Status</th>
                  <th className="th">Wartezeit</th>
                  <th className="th">Angebot / Rückmeldung</th>
                  <th className="th">MA</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {eintraege.map((i) => {
                  const wartetage = Math.floor((now.getTime() - new Date(i.createdAt).getTime()) / 86_400_000);
                  const zeilenKlasse = wartetage >= 90 ? 'border-l-4 border-l-red-500 bg-red-50' :
                                       wartetage >= 60 ? 'border-l-4 border-l-amber-400 bg-amber-50' : '';
                  const rueckmeldungUeberfaellig = (i as any).rueckmeldungBis && new Date((i as any).rueckmeldungBis) < now;
                  return (
                  <tr key={i.id} className={`border-b border-[var(--border)] last:border-0 ${zeilenKlasse}`}>
                    <td className="td">
                      <Link href={`/warteliste/${i.id}`} className="font-medium text-brand-600 hover:underline">
                        {i.nachname}, {i.vorname}
                      </Link>
                      {wartetage >= 90 && <p className="text-xs text-red-600 font-medium">⚠ {wartetage} Tage</p>}
                    </td>
                    <td className="td">
                      {(i.angehoerigerVorname || i.angehoerigerNachname)
                        ? <><span>{i.angehoerigerVorname} {i.angehoerigerNachname}</span><br /><span className="text-xs text-muted">{i.telefonMobil ?? i.telefonFestnetz ?? ''}</span></>
                        : '–'}
                    </td>
                    <td className="td">{i.standort?.name ?? '–'}</td>
                    <td className="td">{PFLEGEGRAD_LABEL[i.pflegegrad]}</td>
                    <td className="td">{PRIO_LABEL[i.prioritaet]}</td>
                    <td className="td"><span className={`badge ${STATUS_COLOR[i.status]}`}>{STATUS_LABEL[i.status]}</span></td>
                    <td className="td whitespace-nowrap text-sm">
                      {wartetage < 30 ? `${wartetage}d` : wartetage < 365 ? `${Math.floor(wartetage/30)}M` : `${Math.floor(wartetage/365)}J ${Math.floor((wartetage%365)/30)}M`}
                    </td>
                    <td className="td text-sm">
                      {(i as any).platzAngebotenAm ? (
                        <div>
                          <p className="text-xs">Angeboten: <strong>{fmtDate((i as any).platzAngebotenAm)}</strong></p>
                          {(i as any).platzAngebotenInfo && <p className="text-xs text-muted">{(i as any).platzAngebotenInfo}</p>}
                          {(i as any).rueckmeldungBis && (
                            <p className={`text-xs font-medium ${rueckmeldungUeberfaellig ? 'text-red-600' : 'text-amber-600'}`}>
                              {rueckmeldungUeberfaellig ? '⚠ Überfällig' : '⏳'} bis {fmtDate((i as any).rueckmeldungBis)}
                            </p>
                          )}
                        </div>
                      ) : '–'}
                    </td>
                    <td className="td"><span className="kuerzel">{i.erstelltVon.kuerzel}</span></td>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <Link href={`/warteliste/${i.id}`} className="text-xs text-brand-600 hover:underline">Öffnen</Link>
                        {can(user, 'interessent.delete') && (
                          <form action={deleteInteressent.bind(null, i.id)}>
                            <button className="btn-danger text-xs px-2 py-1">Löschen</button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {eintraege.length === 0 && (
                  <tr><td colSpan={10} className="td text-center text-muted py-8">Keine Einträge gefunden.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── TAB: FREIE PLÄTZE ─────────────────────────────────── */}
      {tab === 'plaetze' && can(user, 'platz.manage') && (
        <div className="space-y-5">
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
                          ? <span className="badge ml-2 bg-gray-200 text-gray-600">belegt</span>
                          : <span className="badge ml-2 bg-brand-100 text-brand-800">frei</span>}
                      </p>
                      <p className="text-sm text-muted">
                        Frei ab {fmtDate(p.freiAb)} · {GESCHLECHT_LABEL[p.geschlechtPref]}
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
                  {!p.belegt && ms.length > 0 && (
                    <div className="mt-4 border-t border-[var(--border)] pt-3">
                      <p className="text-sm font-medium mb-2">Passende Interessenten</p>
                      <div className="space-y-1">
                        {ms.slice(0, 5).map((m) => (
                          <Link key={m.interessent.id} href={`/warteliste/${m.interessent.id}`}
                            className="flex items-center justify-between text-sm rounded-lg px-2 py-1.5 hover:bg-brand-50 -mx-2">
                            <div>
                              <span className="font-medium text-brand-600">{m.interessent.vorname} {m.interessent.nachname}</span>
                              <span className="text-xs text-muted ml-2">
                                {PFLEGEGRAD_LABEL[m.interessent.pflegegrad]} · {STATUS_LABEL[m.interessent.status]}
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
            {plaetze.length === 0 && <p className="text-sm text-muted card p-5">Noch keine Plätze erfasst.</p>}
          </div>
        </div>
      )}

      {/* ── TAB: WIEDERVORLAGEN ───────────────────────────────── */}
      {tab === 'wiedervorlagen' && can(user, 'wiedervorlage.manage') && (
        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="font-semibold mb-3">Neue Wiedervorlage</h2>
            <WiedervorlageForm />
          </section>

          <div className="flex gap-2">
            <Link href="/warteliste?tab=wiedervorlagen" className={!sp.wv ? 'btn-primary' : 'btn-ghost'}>Offen</Link>
            <Link href="/warteliste?tab=wiedervorlagen&wv=erledigt" className={sp.wv === 'erledigt' ? 'btn-primary' : 'btn-ghost'}>Erledigt</Link>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-[var(--border)]">
                <tr>
                  <th className="th"></th>
                  <th className="th">Titel</th>
                  <th className="th">Typ</th>
                  <th className="th">Interessent</th>
                  <th className="th">Fällig</th>
                  <th className="th">Zuständig</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {wiedervorlagen.map((w) => {
                  const overdue = !w.erledigt && new Date(w.faelligAm) < now;
                  return (
                    <tr key={w.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="td">
                        <form action={toggleWiedervorlage.bind(null, w.id)}>
                          <button title={w.erledigt ? 'Wieder öffnen' : 'Als erledigt markieren'}
                            className="h-5 w-5 rounded border border-[var(--border)] grid place-items-center text-xs">
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
                      <td className="td">
                        <form action={deleteWiedervorlage.bind(null, w.id)}>
                          <button className="btn-danger text-xs px-2 py-1">Löschen</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
                {wiedervorlagen.length === 0 && (
                  <tr><td colSpan={7} className="td text-center text-muted py-8">Keine Wiedervorlagen.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
