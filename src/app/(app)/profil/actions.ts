'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser, verifyPin, hashPin } from '@/lib/auth';

export interface PinActionState {
  ok: boolean;
  error?: string;
}

export async function changePin(_prev: PinActionState, fd: FormData): Promise<PinActionState> {
  const user = await requireUser();

  const aktPin = fd.get('aktPin') as string;
  const neuePin = fd.get('neuePin') as string;
  const pinBestaetigung = fd.get('pinBestaetigung') as string;

  if (!aktPin || !neuePin || !pinBestaetigung) {
    return { ok: false, error: 'Alle Felder müssen ausgefüllt werden.' };
  }
  if (!/^\d{4}$/.test(neuePin)) {
    return { ok: false, error: 'Neue PIN muss genau 4 Ziffern sein.' };
  }
  if (neuePin !== pinBestaetigung) {
    return { ok: false, error: 'Neue PIN und Bestätigung stimmen nicht überein.' };
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) return { ok: false, error: 'Benutzer nicht gefunden.' };

  const pinKorrekt = await verifyPin(aktPin, dbUser.passwordHash);
  if (!pinKorrekt) {
    return { ok: false, error: 'Aktuelle PIN ist falsch.' };
  }

  const neuerHash = await hashPin(neuePin);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: neuerHash } });

  revalidatePath('/profil');
  return { ok: true };
}
