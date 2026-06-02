import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { audit, diffAndLog } from '@/lib/audit';
import { interessentSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const FIELDS = [
  'vorname', 'nachname', 'geburtsdatum', 'pflegegrad', 'krankenkasse', 'wohnsituation',
  'gewuenschterEinzug', 'diagnosen', 'mobilitaet', 'besonderheiten', 'bemerkungen',
  'angehoerigerVorname', 'angehoerigerNachname', 'angehoerigerBeziehung', 'angStrasse',
  'angHausnummer', 'angPlz', 'angOrt', 'telefonFestnetz', 'telefonMobil', 'email',
  'status', 'prioritaet', 'standortId',
] as const;

/** GET /api/interessenten/:id */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  if (!can(user, 'interessent.read')) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });

  const { id } = await params;
  const data = await prisma.interessent.findUnique({
    where: { id },
    include: {
      standort: true,
      erstelltVon: { select: { kuerzel: true, vorname: true, nachname: true } },
      historie: { orderBy: { zeitpunkt: 'desc' } },
      wiedervorlagen: { orderBy: { faelligAm: 'asc' } },
    },
  });
  if (!data) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
  return NextResponse.json({ data });
}

/** PATCH /api/interessenten/:id */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  if (!can(user, 'interessent.update')) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });

  const { id } = await params;
  const before = await prisma.interessent.findUnique({ where: { id }, include: { standort: true } });
  if (!before) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const parsed = interessentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validierung fehlgeschlagen', issues: parsed.error.issues }, { status: 422 });
  }

  const updated = await prisma.interessent.update({
    where: { id },
    data: parsed.data,
    include: { standort: true },
  });

  const vorher: Record<string, unknown> = {};
  const nachher: Record<string, unknown> = {};
  for (const f of FIELDS) {
    vorher[f] = (before as Record<string, unknown>)[f];
    nachher[f] = (updated as Record<string, unknown>)[f];
  }
  await diffAndLog(id, user, vorher, nachher, before.standort?.name, updated.standort?.name);
  await audit(user, 'UPDATE', 'Interessent', id, `${updated.vorname} ${updated.nachname}`);

  return NextResponse.json({ data: updated });
}

/** DELETE /api/interessenten/:id */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  if (!can(user, 'interessent.delete')) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.interessent.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

  await prisma.interessent.delete({ where: { id } });
  await audit(user, 'DELETE', 'Interessent', id, `${existing.vorname} ${existing.nachname}`);

  return NextResponse.json({ ok: true });
}
