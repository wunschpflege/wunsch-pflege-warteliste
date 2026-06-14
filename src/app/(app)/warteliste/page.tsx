import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import {
  STATUS_LABEL, STATUS_COLOR, PFLEGEGRAD_LABEL,
  GESCHLECHT_LABEL, WV_TYP_LABEL, fmtDate,
} from '@/lib/labels';
import type { Prisma } from '@prisma/client';
import WartelisteTabelle from '@/components/WartelisteTabelle';
import WartelisteSuche from '@/components/WartelisteSuche';

type InteressentMitRelationen = Prisma.InteressentGetPayload<{
  include: { standort: true; erstelltVon: true };
}>;

type PlatzMitStandort = Prisma.PlatzGetPayload<{
  include: { standort: true };
}>;

type WiedervorlageMitRelationen = Prisma.WiedervorlageGetPayload<{
  include: { interessent: true; zustaendig: true };
}>;
import { toggleWiedervorlage, deleteWiedervorlage } from './actions';
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
  const sortBy = sp.sortBy ?? 'createdAt';
  const sortDir = (sp.sortDir ?? 'asc') as 'asc' | 'desc';
  const nurMarkierte = sp.markiert === '1';
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
    if (nurMarkierte) and.push({ markiert: true } as never);
    if (sp.von || sp.bis) and.push({ createdAt: {
      ...(sp.von ? { gte: new Date(sp.von) } : {}),
      ...(sp.bis ? { lte: new Date(sp.bis + 'T23:59:59') } : {}),
    }});
    if (and.length) where.AND = and;
    const allowedSortFields = ['createdAt', 'nachname', 'prioritaet', 'status'] as const;
    type SortField = typeof allowedSortFields[number];
    const safeSortBy: SortField = (allowedSortFields as readonly string[]).includes(sortBy) ? sortBy as SortField : 'createdAt';
    eintraege = await prisma.interessent.findMany({
      where,
      include: { standort: true, erstelltVon: true },
      orderBy: [{ [safeSortBy]: sortDir }],
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

  const baseFilterQs = new URLSearchParams(
    Object.entries({ tab: 'interessenten', q: sp.q ?? '', standort: sp.standort ?? '', status: sp.status ?? '', pflegegrad: sp.pflegegrad ?? '', mitarbeiter: sp.mitarbeiter ?? '', von: sp.von ?? '', bis: sp.bis ?? '', markiert: sp.markiert ?? '' })
      .filter(([, v]) => v) as [string, string][]
  ).toString();

  const exportQs = new URLSearchParams(
    Object.entries(sp).filter(([k, v]) => v && k !== 'tab') as [string, string][],
  ).toString();

  const tabs = [
    { key: 'interessenten', label: 'Interessenten' },
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
          <WartelisteSuche
            standorte={standorte}
            mitarbeiter={mitarbeiter.map((m) => ({ id: m.id, kuerzel: m.kuerzel, vorname: m.vorname, nachname: m.nachname }))}
            defaults={{ q: sp.q ?? '', standort: sp.standort ?? '', status: sp.status ?? '', pflegegrad: sp.pflegegrad ?? '', mitarbeiter: sp.mitarbeiter ?? '', von: sp.von ?? '', bis: sp.bis ?? '' }}
            nurMarkierte={nurMarkierte}
          />

          <p className="text-sm text-muted">{eintraege.length} Einträge</p>

          <WartelisteTabelle
            eintraege={eintraege.map((i) => ({
              id: i.id,
              vorname: i.vorname,
              nachname: i.nachname,
              pflegegrad: i.pflegegrad,
              prioritaet: i.prioritaet,
              status: i.status,
              createdAt: i.createdAt,
              letzterKontakt: (i as any).letzterKontakt ?? null,
              schnellnotiz: (i as any).schnellnotiz ?? null,
              markiert: (i as any).markiert ?? false,
              telefonMobil: i.telefonMobil ?? null,
              telefonFestnetz: i.telefonFestnetz ?? null,
              angehoerigerVorname: i.angehoerigerVorname ?? null,
              angehoerigerNachname: i.angehoerigerNachname ?? null,
              platzAngebotenAm: (i as any).platzAngebotenAm ?? null,
              platzAngebotenInfo: (i as any).platzAngebotenInfo ?? null,
              platzAngebotenWg: (i as any).platzAngebotenWg ?? null,
              rueckmeldungBis: (i as any).rueckmeldungBis ?? null,
              standort: i.standort ?? null,
              erstelltVon: i.erstelltVon,
            }))}
            canUpdate={can(user, 'interessent.update')}
            canDelete={can(user, 'interessent.delete')}
            sortBy={sortBy}
            sortDir={sortDir}
            baseFilterQs={baseFilterQs}
          />
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
