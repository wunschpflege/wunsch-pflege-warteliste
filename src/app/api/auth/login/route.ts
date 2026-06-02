import { NextResponse, type NextRequest } from 'next/server';
import { authenticate, createSession } from '@/lib/auth';
import { audit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  let username = '';
  let pin = '';
  const ct = req.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    const b = await req.json();
    username = b.username ?? '';
    pin = b.pin ?? '';
  } else {
    const fd = await req.formData();
    username = String(fd.get('username') ?? '');
    pin = String(fd.get('pin') ?? '');
  }

  const user = await authenticate(username, pin);
  if (!user) {
    return NextResponse.json({ error: 'Benutzername oder PIN ist falsch.' }, { status: 401 });
  }
  await createSession(user);
  await audit(user, 'LOGIN', 'User', user.id, 'Erfolgreiche Anmeldung');
  return NextResponse.json({ ok: true, user: { kuerzel: user.kuerzel, role: user.role } });
}
