import { NextResponse } from 'next/server';
import { nichtAngemeldet, pruefeSitzung } from '@/lib/auth';
import { inaktivMinuten } from '@/lib/inaktiv';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/aktiv – "ich bin noch da": Der Browser meldet Eingaben (Tippen, Scrollen, Lesen
 * mit Antippen), aus denen keine normale Anfrage entstanden ist, hoechstens einmal pro Minute.
 * Verlaengert die Sitzung; ist sie schon abgelaufen, kommt 401 mit `code: 'inaktiv'`.
 */
export async function POST() {
  const status = await pruefeSitzung({ sofortMerken: true });
  if (!status.user) return nichtAngemeldet();
  return NextResponse.json(
    { ok: true, inaktivMinuten: inaktivMinuten() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
