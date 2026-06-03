import { NextResponse, type NextRequest } from 'next/server';
import { authenticate, createSession } from '@/lib/auth';
import { audit } from '@/lib/audit';

// ─── Brute-Force-Schutz ──────────────────────────────────────────────────────
// Erlaubt max. 5 Fehlversuche pro IP innerhalb von 15 Minuten.
// Bei Überschreitung wird die IP für 15 Minuten gesperrt.
const WINDOW_MS  = 15 * 60 * 1000; // 15 Minuten
const MAX_FAILS  = 5;
const BLOCK_MS   = 15 * 60 * 1000; // 15 Minuten Sperre

interface Attempt { count: number; firstAt: number; blockedUntil?: number }
const attempts = new Map<string, Attempt>();

// Cleanup alle 5 Minuten (verhindert Memory-Leak)
setInterval(() => {
  const now = Date.now();
  for (const [ip, a] of attempts) {
    if (a.blockedUntil && now > a.blockedUntil) { attempts.delete(ip); continue; }
    if (now - a.firstAt > WINDOW_MS) attempts.delete(ip);
  }
}, 5 * 60 * 1000);

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

function checkRateLimit(ip: string): { blocked: boolean; remaining: number } {
  const now = Date.now();
  const a = attempts.get(ip);

  if (a?.blockedUntil) {
    if (now < a.blockedUntil) return { blocked: true, remaining: 0 };
    attempts.delete(ip); // Sperre abgelaufen
  }

  if (!a || now - a.firstAt > WINDOW_MS) {
    attempts.set(ip, { count: 0, firstAt: now });
    return { blocked: false, remaining: MAX_FAILS };
  }

  return { blocked: false, remaining: MAX_FAILS - a.count };
}

function recordFail(ip: string): void {
  const now = Date.now();
  const a = attempts.get(ip) ?? { count: 0, firstAt: now };
  a.count += 1;
  if (a.count >= MAX_FAILS) a.blockedUntil = now + BLOCK_MS;
  attempts.set(ip, a);
}

function recordSuccess(ip: string): void {
  attempts.delete(ip);
}
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const { blocked } = checkRateLimit(ip);

  if (blocked) {
    return NextResponse.json(
      { error: 'Zu viele Fehlversuche. Bitte 15 Minuten warten.' },
      { status: 429, headers: { 'Retry-After': '900' } }
    );
  }

  let username = '';
  let pin = '';
  const ct = req.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    const b = await req.json();
    username = String(b.username ?? '').trim().toLowerCase();
    pin      = String(b.pin ?? '');
  } else {
    const fd = await req.formData();
    username = String(fd.get('username') ?? '').trim().toLowerCase();
    pin      = String(fd.get('pin') ?? '');
  }

  // PIN-Format validieren (4 Ziffern) — kein DB-Hit bei offensichtlich falschem Input
  if (!/^\d{4}$/.test(pin)) {
    recordFail(ip);
    return NextResponse.json({ error: 'Benutzername oder PIN ist falsch.' }, { status: 401 });
  }

  const user = await authenticate(username, pin);
  if (!user) {
    recordFail(ip);
    return NextResponse.json({ error: 'Benutzername oder PIN ist falsch.' }, { status: 401 });
  }

  recordSuccess(ip);
  await createSession(user);
  await audit(user, 'LOGIN', 'User', user.id, `Anmeldung von IP ${ip}`);
  return NextResponse.json({ ok: true, user: { kuerzel: user.kuerzel, role: user.role } });
}
