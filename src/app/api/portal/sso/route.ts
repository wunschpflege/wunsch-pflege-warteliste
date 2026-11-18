import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { authenticatePortal, loginSession } from '@/lib/auth';
import { PORTAL_APP_ID, PORTAL_ISSUER, portalSecret, jtiEinloesen, sicheresZiel } from '@/lib/portal';

export const dynamic = 'force-dynamic';

function weiter(pfad: string): NextResponse {
  // Relative Weiterleitung: unabhaengig vom Hostnamen hinter dem Proxy
  return new NextResponse(null, {
    status: 302,
    headers: { Location: pfad, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });
}

function abgelehnt(grund: string): NextResponse {
  // Keine Details an den Browser, nur ins Server-Log (ohne Token)
  console.warn(`[portal] SSO abgelehnt: ${grund}`);
  return weiter('/login');
}

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

/**
 * Automatische Anmeldung ueber das Wunsch-Pflege Portal.
 * Das Portal leitet den Browser mit einem kurzlebigen, einmal gueltigen JWT (HS256) hierher.
 */
export async function GET(req: NextRequest) {
  const secret = portalSecret();
  if (!secret) return new NextResponse(null, { status: 404 });

  const token = req.nextUrl.searchParams.get('token');
  if (!token) return abgelehnt('kein Token');

  // 1.–3. Algorithmus (nur HS256), Signatur, iss/aud; exp ohne Toleranz
  let payload;
  try {
    ({ payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ['HS256'],
      issuer: PORTAL_ISSUER,
      audience: PORTAL_APP_ID,
      requiredClaims: ['iss', 'aud', 'sub', 'iat', 'exp', 'jti'],
      clockTolerance: 0,
    }));
  } catch (e) {
    const code = (e as { code?: string })?.code ?? 'unbekannt';
    return abgelehnt(`Token ungültig (${code})`);
  }

  // 4. Zeitfenster
  const { iat, exp, jti, sub, aud } = payload;
  const jetzt = Math.floor(Date.now() / 1000);
  if (typeof aud !== 'string') return abgelehnt('aud nicht eindeutig');
  if (typeof iat !== 'number' || typeof exp !== 'number') return abgelehnt('iat/exp fehlt');
  if (exp <= jetzt) return abgelehnt('abgelaufen');
  if (iat > jetzt + 60) return abgelehnt('iat liegt in der Zukunft');
  if (exp - iat > 120) return abgelehnt('Laufzeit zu lang');
  if (typeof jti !== 'string' || !jti || typeof sub !== 'string' || !sub) return abgelehnt('jti/sub fehlt');

  // 5. Jedes Token nur einmal
  if (!jtiEinloesen(jti, exp)) return abgelehnt('Token bereits benutzt');

  try {
    // 6. Genau ein aktives Konto mit diesem Benutzernamen
    const user = await authenticatePortal(sub);
    if (!user) return abgelehnt('kein aktives Konto zum Anmeldenamen');

    // Ganz normale Sitzung wie beim PIN-Login (gleiches Cookie, gleicher Audit-Eintrag)
    await loginSession(user, `Anmeldung über Portal von IP ${getIp(req)}`);
  } catch {
    return abgelehnt('interner Fehler bei der Anmeldung');
  }
  return weiter(sicheresZiel(req.nextUrl.searchParams.get('ziel')));
}
