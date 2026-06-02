import { NextResponse } from 'next/server';
import { getSession, destroySession } from '@/lib/auth';
import { audit } from '@/lib/audit';

export async function POST() {
  const user = await getSession();
  await destroySession();
  if (user) await audit(user, 'LOGOUT', 'User', user.id, 'Abmeldung');
  return NextResponse.json({ ok: true });
}
