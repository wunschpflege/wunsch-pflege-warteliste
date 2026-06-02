import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { audit, logHistorie } from '@/lib/audit';
import { interessentSchema } from '@/lib/validation';
import { buildInteressentWhere, filterFromSearchParams } from '@/lib/interessentFilter';

export const dynamic = 'force-dynamic';

/** GET /api/interessenten – Liste mit Such-/Filterparametern. */
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  if (!can(user, 'interessent.read')) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const where = buildInteressentWhere(filterFromSearchParams(sp));
  const take = Math.min(Number(sp.get('limit') ?? 100) || 100, 500);

  const data = await prisma.interessent.findMany({
    where,
    include: { standort: true, erstelltVon: { select: { kuerzel: true, vorname: true, nachname: true } } },
    orderBy: [{ prioritaet: 'desc' }, { createdAt: 'asc' }],
    take,
  });

  return NextResponse.json({ count: data.length, data });
}

/** POST /api/interessenten – neuen Interessenten anlegen. */
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  if (!can(user, 'interessent.create')) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });

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

  const created = await prisma.interessent.create({
    data: { ...parsed.data, erstelltVonId: user.id },
  });

  await logHistorie(created.id, user, 'Datensatz angelegt (API)');
  await audit(user, 'CREATE', 'Interessent', created.id, `${created.vorname} ${created.nachname}`);

  return NextResponse.json({ data: created }, { status: 201 });
}
