'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { audit } from '@/lib/audit';
import { platzSchema, formToObject } from '@/lib/validation';

type State = { ok: boolean; error?: string };

export async function savePlatz(id: string | null, _prev: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  requirePermission(user, 'platz.manage');
  const obj = formToObject(fd);
  const parsed = platzSchema.safeParse({ ...obj, belegt: fd.get('belegt') === 'on' });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Eingabe prüfen.' };

  if (id) {
    await prisma.platz.update({ where: { id }, data: parsed.data });
    await audit(user, 'UPDATE', 'Platz', id, parsed.data.zimmernummer);
  } else {
    const c = await prisma.platz.create({ data: parsed.data });
    await audit(user, 'CREATE', 'Platz', c.id, parsed.data.zimmernummer);
  }
  revalidatePath('/plaetze');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function togglePlatzBelegt(id: string): Promise<void> {
  const user = await requireUser();
  requirePermission(user, 'platz.manage');
  const p = await prisma.platz.findUnique({ where: { id } });
  if (!p) return;
  await prisma.platz.update({ where: { id }, data: { belegt: !p.belegt } });
  await audit(user, 'UPDATE', 'Platz', id, p.belegt ? 'als frei markiert' : 'als belegt markiert');
  revalidatePath('/plaetze');
  revalidatePath('/dashboard');
}

export async function deletePlatz(id: string): Promise<void> {
  const user = await requireUser();
  requirePermission(user, 'platz.manage');
  await prisma.platz.delete({ where: { id } });
  await audit(user, 'DELETE', 'Platz', id);
  revalidatePath('/plaetze');
}

export async function platzBelegen(id: string, fd: FormData): Promise<void> {
  const user = await requireUser();
  requirePermission(user, 'platz.manage');
  const name = fd.get('bewohnerName') as string;
  const seit = fd.get('belegtSeit') as string;
  await prisma.platz.update({
    where: { id },
    data: {
      belegt: true,
      bewohnerName: name || null,
      belegtSeit: seit ? new Date(seit) : new Date(),
    } as never,
  });
  revalidatePath('/plaetze');
  revalidatePath('/dashboard');
}

export async function platzFreigeben(id: string, fd: FormData): Promise<void> {
  const user = await requireUser();
  requirePermission(user, 'platz.manage');
  const platz = await prisma.platz.findUnique({ where: { id } });
  if (!platz) return;
  const auszugAm = fd.get('auszugAm') as string;
  const auszugGrund = fd.get('auszugGrund') as string;
  const bemerkung = fd.get('bemerkung') as string;
  // Archiv-Eintrag anlegen
  await (prisma as any).bewohnerArchiv.create({
    data: {
      standortId: platz.standortId,
      bewohnerName: (platz as any).bewohnerName ?? 'Unbekannt',
      belegtSeit: (platz as any).belegtSeit ?? null,
      auszugAm: auszugAm ? new Date(auszugAm) : new Date(),
      auszugGrund: auszugGrund || 'AUSGEZOGEN',
      bemerkung: bemerkung || null,
    },
  });
  await prisma.platz.update({
    where: { id },
    data: { belegt: false, bewohnerName: null, belegtSeit: null } as never,
  });
  revalidatePath('/plaetze');
  revalidatePath('/archiv');
  revalidatePath('/dashboard');
}

export async function platzAnlegen(fd: FormData): Promise<void> {
  const user = await requireUser();
  requirePermission(user, 'platz.manage');
  const standortId = fd.get('standortId') as string;
  const zimmernummer = fd.get('zimmernummer') as string;
  const bewohnerName = fd.get('bewohnerName') as string;
  const belegtSeit = fd.get('belegtSeit') as string;
  const belegt = !!bewohnerName;
  await prisma.platz.create({
    data: {
      standortId,
      zimmernummer: zimmernummer || '-',
      belegt,
      bewohnerName: bewohnerName || null,
      belegtSeit: belegtSeit ? new Date(belegtSeit) : belegt ? new Date() : null,
    } as never,
  });
  revalidatePath('/plaetze');
  revalidatePath('/dashboard');
}

export async function platzLoeschen(id: string): Promise<void> {
  const user = await requireUser();
  requirePermission(user, 'platz.manage');
  await prisma.platz.delete({ where: { id } });
  revalidatePath('/plaetze');
  revalidatePath('/dashboard');
}
