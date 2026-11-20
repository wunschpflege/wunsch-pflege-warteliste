import { NextResponse, type NextRequest } from 'next/server';
import { getSession, destroySession } from '@/lib/auth';
import { audit } from '@/lib/audit';

/**
 * Abmeldung. Mit `{ "grund": "inaktiv" }` meldet der Browser die automatische Abmeldung
 * (zu lange keine Eingabe); das steht dann so im Protokoll.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const inaktiv = (body as { grund?: unknown } | null)?.grund === 'inaktiv';
  const user = await getSession();
  await destroySession(inaktiv ? 'inaktiv' : 'abmeldung');
  if (user) {
    await audit(user, 'LOGOUT', 'User', user.id, inaktiv ? 'Automatische Abmeldung nach Inaktivität' : 'Abmeldung');
  }
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
