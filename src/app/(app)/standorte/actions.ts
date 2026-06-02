'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { audit } from '@/lib/audit';
import { standortSchema, formToObject } from '@/lib/validation';

export async function saveStandort(id: string | null, _prev: { ok: boolean; error?: string }, fd: FormData) {
  const user = await requireUser();
  requirePermission(user, 'standort.manage');
  const obj = formToObject(fd);
  const parsed = standortSchema.safeParse({ ...obj, aktiv: fd.get('aktiv') === 'on' });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Eingabe prüfen.' };

  if (id) {
    await prisma.standort.update({ where: { id }, data: parsed.data });
    await audit(user, 'UPDATE', 'Standort', id, parsed.data.name);
  } else {
    const created = await prisma.standort.create({ data: parsed.data });
    await audit(user, 'CREATE', 'Standort', created.id, parsed.data.name);
  }
  revalidatePath('/standorte');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function toggleStandort(id: string): Promise<void> {
  const user = await requireUser();
  requirePermission(user, 'standort.manage');
  const s = await prisma.standort.findUnique({ where: { id } });
  if (!s) return;
  await prisma.standort.update({ where: { id }, data: { aktiv: !s.aktiv } });
  await audit(user, 'UPDATE', 'Standort', id, s.aktiv ? 'deaktiviert' : 'aktiviert');
  revalidatePath('/standorte');
}
