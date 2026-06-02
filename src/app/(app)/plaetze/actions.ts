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
