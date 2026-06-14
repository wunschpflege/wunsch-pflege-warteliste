'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { audit, logHistorie, diffAndLog } from '@/lib/audit';
import { interessentSchema, wiedervorlageSchema, formToObject } from '@/lib/validation';

export interface ActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const FIELDS = [
  'vorname', 'nachname', 'geburtsdatum', 'pflegegrad', 'krankenkasse', 'wohnsituation',
  'gewuenschterEinzug', 'diagnosen', 'mobilitaet', 'besonderheiten', 'bemerkungen',
  'angehoerigerVorname', 'angehoerigerNachname', 'angehoerigerBeziehung', 'angStrasse',
  'angHausnummer', 'angPlz', 'angOrt', 'telefonFestnetz', 'telefonMobil', 'email',
  'status', 'prioritaet', 'standortId',
  'platzAngebotenAm', 'platzAngebotenInfo', 'rueckmeldungBis',
  'schnellnotiz', 'letzterKontakt', 'markiert',
] as const;

function getWunschStandorteIds(fd: FormData): string[] {
  return fd.getAll('wunschStandorteIds').map(String).filter(Boolean);
}

export async function createInteressent(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, 'interessent.create');

  const parsed = interessentSchema.safeParse(formToObject(fd));
  if (!parsed.success) {
    return { ok: false, fieldErrors: flattenZod(parsed.error), error: 'Bitte Eingaben prüfen.' };
  }
  const data = parsed.data;
  const wunschIds = getWunschStandorteIds(fd);

  const duplikat = await prisma.interessent.findFirst({
    where: {
      vorname: { equals: data.vorname, mode: 'insensitive' },
      nachname: { equals: data.nachname, mode: 'insensitive' },
      status: { notIn: ['ABGELEHNT', 'ARCHIVIERT'] },
    },
  });
  if (duplikat) {
    return { ok: false, error: `Mögliches Duplikat: ${duplikat.vorname} ${duplikat.nachname} existiert bereits (Status: ${duplikat.status}). Bitte prüfen oder trotzdem anlegen.` };
  }

  const created = await prisma.interessent.create({
    data: {
      ...data,
      erstelltVonId: user.id,
      wunschStandorte: wunschIds.length ? { connect: wunschIds.map((id) => ({ id })) } : undefined,
    },
  });

  await logHistorie(created.id, user, 'Datensatz angelegt');
  await audit(user, 'CREATE', 'Interessent', created.id, `${data.vorname} ${data.nachname}`);

  revalidatePath('/warteliste');
  revalidatePath('/dashboard');
  redirect('/warteliste');
}

export async function updateInteressent(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, 'interessent.update');

  const existing = await prisma.interessent.findUnique({ where: { id }, include: { standort: true } });
  if (!existing) return { ok: false, error: 'Datensatz nicht gefunden.' };

  const parsed = interessentSchema.safeParse(formToObject(fd));
  if (!parsed.success) {
    return { ok: false, fieldErrors: flattenZod(parsed.error), error: 'Bitte Eingaben prüfen.' };
  }
  const data = parsed.data;

  // Standortnamen fuer die Historie aufloesen
  let standortNameNeu: string | undefined;
  if (data.standortId && data.standortId !== existing.standortId) {
    const s = await prisma.standort.findUnique({ where: { id: data.standortId } });
    standortNameNeu = s?.name;
  } else {
    standortNameNeu = existing.standort?.name;
  }

  const vorher: Record<string, unknown> = {};
  const nachher: Record<string, unknown> = {};
  for (const f of FIELDS) {
    vorher[f] = (existing as Record<string, unknown>)[f];
    nachher[f] = (data as Record<string, unknown>)[f];
  }

  const wunschIds = getWunschStandorteIds(fd);
  await prisma.interessent.update({
    where: { id },
    data: {
      ...data,
      wunschStandorte: { set: wunschIds.map((sid) => ({ id: sid })) },
    },
  });
  await diffAndLog(id, user, vorher, nachher, existing.standort?.name, standortNameNeu);
  await audit(user, 'UPDATE', 'Interessent', id, `${data.vorname} ${data.nachname}`);

  revalidatePath(`/warteliste/${id}`);
  revalidatePath('/warteliste');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function deleteInteressent(id: string): Promise<void> {
  const user = await requireUser();
  requirePermission(user, 'interessent.delete');
  const ex = await prisma.interessent.findUnique({ where: { id } });
  await prisma.interessent.delete({ where: { id } });
  await audit(user, 'DELETE', 'Interessent', id, ex ? `${ex.vorname} ${ex.nachname}` : undefined);
  revalidatePath('/warteliste');
  redirect('/warteliste');
}

export async function addWiedervorlage(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, 'wiedervorlage.manage');
  const parsed = wiedervorlageSchema.safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, error: 'Bitte Titel und Datum angeben.' };
  const d = parsed.data;

  const wv = await prisma.wiedervorlage.create({
    data: {
      typ: d.typ, titel: d.titel, notiz: d.notiz, faelligAm: d.faelligAm,
      interessentId: d.interessentId, zustaendigId: user.id, kuerzel: user.kuerzel,
    },
  });
  if (d.interessentId) {
    await logHistorie(d.interessentId, user, `Wiedervorlage angelegt: ${d.titel}`);
    revalidatePath(`/warteliste/${d.interessentId}`);
  }
  await audit(user, 'CREATE', 'Wiedervorlage', wv.id, d.titel);
  revalidatePath('/wiedervorlagen');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function deleteWiedervorlage(id: string): Promise<void> {
  const user = await requireUser();
  requirePermission(user, 'wiedervorlage.manage');
  const wv = await prisma.wiedervorlage.findUnique({ where: { id } });
  if (!wv) return;
  await prisma.wiedervorlage.delete({ where: { id } });
  await audit(user, 'DELETE', 'Wiedervorlage', id, wv.titel);
  revalidatePath('/wiedervorlagen');
  revalidatePath('/dashboard');
}

export async function toggleWiedervorlage(id: string): Promise<void> {
  const user = await requireUser();
  requirePermission(user, 'wiedervorlage.manage');
  const wv = await prisma.wiedervorlage.findUnique({ where: { id } });
  if (!wv) return;
  await prisma.wiedervorlage.update({
    where: { id },
    data: { erledigt: !wv.erledigt, erledigtAm: !wv.erledigt ? new Date() : null },
  });
  await audit(user, 'UPDATE', 'Wiedervorlage', id, wv.erledigt ? 'wieder offen' : 'erledigt');
  revalidatePath('/wiedervorlagen');
  revalidatePath('/dashboard');
}

export async function schnellStatusAendern(id: string, status: string): Promise<void> {
  const user = await requireUser();
  requirePermission(user, 'interessent.update');
  await prisma.interessent.update({ where: { id }, data: { status: status as never } });
  revalidatePath('/warteliste');
}

export async function toggleMarkiert(id: string): Promise<void> {
  const user = await requireUser();
  requirePermission(user, 'interessent.update');
  const i = await prisma.interessent.findUnique({ where: { id } });
  if (!i) return;
  await prisma.interessent.update({ where: { id }, data: { markiert: !(i as any).markiert } });
  revalidatePath('/warteliste');
}

export async function zimmerAnbieten(id: string, fd: FormData): Promise<void> {
  const user = await requireUser();
  requirePermission(user, 'interessent.update');
  const datum = fd.get('platzAngebotenAm') as string | null;
  const info = fd.get('platzAngebotenInfo') as string | null;
  const wg = fd.get('platzAngebotenWg') as string | null;
  const rueckmeldung = fd.get('rueckmeldungBis') as string | null;
  await prisma.interessent.update({
    where: { id },
    data: {
      platzAngebotenAm: datum ? new Date(datum) : null,
      platzAngebotenInfo: info || null,
      platzAngebotenWg: wg || null,
      rueckmeldungBis: rueckmeldung ? new Date(rueckmeldung) : null,
    } as never,
  });
  const i = await prisma.interessent.findUnique({ where: { id } });
  if (i) await logHistorie(id, user, `Zimmer angeboten: ${info ?? ''} · ${wg ?? ''} am ${datum ?? ''}`);
  revalidatePath('/warteliste');
}

export async function letzterKontaktEintragen(id: string, fd: FormData): Promise<void> {
  const user = await requireUser();
  requirePermission(user, 'interessent.update');
  const datum = fd.get('letzterKontakt') as string | null;
  const wg = fd.get('platzAngebotenWg') as string | null;
  const bewohner = fd.get('platzAngebotenInfo') as string | null;
  const data: Record<string, unknown> = {};
  if (datum) data.letzterKontakt = new Date(datum);
  if (wg !== null) data.platzAngebotenWg = wg || null;
  if (bewohner !== null) data.platzAngebotenInfo = bewohner || null;
  if (wg) data.platzAngebotenAm = datum ? new Date(datum) : new Date();
  await prisma.interessent.update({ where: { id }, data: data as never });
  const teile = [`Telefonat am ${datum ?? '–'}`];
  if (wg) teile.push(`Zimmer angeboten: ${wg}${bewohner ? ` (von ${bewohner})` : ''}`);
  await logHistorie(id, user, teile.join(' · '));
  revalidatePath('/warteliste');
}

export async function bulkStatusAendern(ids: string[], status: string): Promise<void> {
  const user = await requireUser();
  requirePermission(user, 'interessent.update');
  await prisma.interessent.updateMany({ where: { id: { in: ids } }, data: { status: status as never } });
  revalidatePath('/warteliste');
}

function flattenZod(err: import('zod').ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? '_');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
