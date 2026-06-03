'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser, hashPin } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { audit } from '@/lib/audit';
import { buildInitials } from '@/lib/initials';
import { userSchema, formToObject } from '@/lib/validation';

type State = { ok: boolean; error?: string };

/** Eindeutiges Kuerzel erzeugen (bei Kollision Ziffer anhaengen). */
async function uniqueKuerzel(vorname: string, nachname: string, ignoreId?: string): Promise<string> {
  const base = buildInitials(vorname, nachname);
  let candidate = base;
  let n = 1;
  while (true) {
    const found = await prisma.user.findFirst({ where: { kuerzel: candidate, NOT: ignoreId ? { id: ignoreId } : undefined } });
    if (!found) return candidate;
    n += 1;
    candidate = `${base}${n}`;
  }
}

/** Generiert Benutzername aus Vorname.Nachname (lowercase, ohne Sonderzeichen). */
function buildUsername(vorname: string, nachname: string): string {
  const normalize = (s: string) =>
    s.toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]/g, '');
  return `${normalize(vorname)}.${normalize(nachname)}`;
}

/** Eindeutigen Benutzernamen erzeugen. */
async function uniqueUsername(vorname: string, nachname: string, ignoreId?: string): Promise<string> {
  const base = buildUsername(vorname, nachname);
  let candidate = base;
  let n = 2;
  while (true) {
    const found = await prisma.user.findFirst({ where: { username: candidate, NOT: ignoreId ? { id: ignoreId } : undefined } });
    if (!found) return candidate;
    candidate = `${base}${n}`;
    n += 1;
  }
}

export async function saveUser(id: string | null, _prev: State, fd: FormData): Promise<State> {
  const actor = await requireUser();
  requirePermission(actor, 'user.manage');

  const parsed = userSchema.safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Eingabe prüfen.' };
  const { vorname, nachname, role, pin } = parsed.data;

  const kuerzel = await uniqueKuerzel(vorname, nachname, id ?? undefined);
  const username = await uniqueUsername(vorname, nachname, id ?? undefined);

  if (id) {
    const data: Record<string, unknown> = { vorname, nachname, role, kuerzel, username };
    if (pin) data.passwordHash = await hashPin(pin);
    await prisma.user.update({ where: { id }, data });
    await audit(actor, 'UPDATE', 'User', id, `${vorname} ${nachname} (${kuerzel})`);
  } else {
    if (!pin) return { ok: false, error: 'Bitte eine Start-PIN vergeben (4 Ziffern).' };
    const created = await prisma.user.create({
      data: { vorname, nachname, role, kuerzel, username, passwordHash: await hashPin(pin) },
    });
    await audit(actor, 'CREATE', 'User', created.id, `${vorname} ${nachname} (${kuerzel}) → ${username}`);
  }
  revalidatePath('/benutzer');
  return { ok: true };
}

export async function deleteUser(id: string): Promise<void> {
  const actor = await requireUser();
  requirePermission(actor, 'user.manage');
  if (id === actor.id) return;
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) return;
  await prisma.user.delete({ where: { id } });
  await audit(actor, 'DELETE', 'User', id, `${u.vorname} ${u.nachname} (${u.kuerzel})`);
  revalidatePath('/benutzer');
}

export async function toggleUserAktiv(id: string): Promise<void> {
  const actor = await requireUser();
  requirePermission(actor, 'user.manage');
  if (id === actor.id) return;
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) return;
  await prisma.user.update({ where: { id }, data: { aktiv: !u.aktiv } });
  await audit(actor, 'UPDATE', 'User', id, u.aktiv ? 'deaktiviert' : 'aktiviert');
  revalidatePath('/benutzer');
}
