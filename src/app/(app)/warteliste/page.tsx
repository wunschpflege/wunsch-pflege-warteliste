import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { STATUS_LABEL, STATUS_COLOR, PFLEGEGRAD_LABEL, PRIO_LABEL, fmtDate } from '@/lib/labels';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | undefined>;

export default async function WartelistePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await getSession();
  const q = (sp.q ?? '').trim();

  const where: Prisma.InteressentWhereInput = {};
  const and: Prisma.InteressentWhereInput[] = [];

  if (q) {
    and.push({
      OR: [
        { vorname: { contains: q, mode: 'insensitive' } },
        { nachname: { contains: q, mode: 'insensitive' } },
        { telefonFestnetz: { contains: q } },
        { telefonMobil: { contains: q } },
        { angehoerigerNachname: { contains: q, mode: 'insensitive' } },
        { angehoerigerVorname: { contains: q, mode: 'insensitive' } },
      ],
    });
  }
  if (sp.standort) and.push({ standortId: sp.standort });
  if (sp.status) and.push({ status: sp.status as never });
  if (sp.pflegegrad) and.push({ pflegegrad: sp.pflegegrad as never });
  if (sp.mitarbeiter) and.push({ erstelltVonId: sp.mitarbeiter });
  if (sp.von || sp.bis) {
    and.push({
      createdAt: {
        ...(sp.von ? { gte: new Date(sp.von) } : {}),
        ...(sp.bis ? { lte: new Date(sp.bis + 'T23:59:59') } : {}),
      },
    });
  }
  if (and.length) where.AND = and;

  const [eintraege, standorte, mitarbeiter] = await Promise.all([
    prisma.interessent.findMany({
      where,
      include: { standort: true, erstelltVon: true },
      orderBy: [{ prioritaet: 'desc' }, { createdAt: 'asc' }],
      take: 300,
    }),
    prisma.standort.findMany({ where: { aktiv: true }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({ where: { aktiv: true }, orderBy: { nachname: 'asc' } }),
  ]);

  const exportQs = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => v) as [string, string][],
  ).toString();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Warteliste</h1>
        <div className="flex gap-2">
          {can(user, 'export') && (
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

      {/* Such- und Filterleiste */}
      <form className="card p-4 grid md:grid-cols-3 lg:grid-cols-4 gap-3" method="get">
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
          <Link href="/warteliste" className="btn-ghost">Zurücksetzen</Link>
        </div>
      </form>

      <p className="text-sm text-muted">{eintraege.length} Einträge</p>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-[var(--border)]">
            <tr>
              <th className="th">Name</th>
              <th className="th">Standort</th>
              <th className="th">Pflegegrad</th>
              <th className="th">Priorität</th>
              <th className="th">Status</th>
              <th className="th">Eingetragen</th>
              <th className="th">MA</th>
            </tr>
          </thead>
          <tbody>
            {eintraege.map((i) => (
              <tr key={i.id} className="border-b border-[var(--border)] last:border-0 hover:bg-black/5 dark:hover:bg-white/5">
                <td className="td">
                  <Link href={`/warteliste/${i.id}`} className="font-medium text-brand-600 hover:underline">
                    {i.nachname}, {i.vorname}
                  </Link>
                </td>
                <td className="td">{i.standort?.name ?? '–'}</td>
                <td className="td">{PFLEGEGRAD_LABEL[i.pflegegrad]}</td>
                <td className="td">{PRIO_LABEL[i.prioritaet]}</td>
                <td className="td"><span className={`badge ${STATUS_COLOR[i.status]}`}>{STATUS_LABEL[i.status]}</span></td>
                <td className="td whitespace-nowrap">{fmtDate(i.createdAt)}</td>
                <td className="td"><span className="kuerzel">{i.erstelltVon.kuerzel}</span></td>
              </tr>
            ))}
            {eintraege.length === 0 && (
              <tr><td colSpan={7} className="td text-center text-muted py-8">Keine Einträge gefunden.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
