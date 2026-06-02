import type { Prisma } from '@prisma/client';

export type InteressentFilter = {
  q?: string;
  standort?: string;
  status?: string;
  pflegegrad?: string;
  mitarbeiter?: string;
  von?: string;
  bis?: string;
};

/**
 * Baut das Prisma-Where-Objekt fuer Such- und Filteranfragen.
 * Wird von Warteliste, REST-API und Export gemeinsam genutzt.
 */
export function buildInteressentWhere(f: InteressentFilter): Prisma.InteressentWhereInput {
  const and: Prisma.InteressentWhereInput[] = [];
  const q = (f.q ?? '').trim();

  if (q) {
    and.push({
      OR: [
        { vorname: { contains: q, mode: 'insensitive' } },
        { nachname: { contains: q, mode: 'insensitive' } },
        { telefonFestnetz: { contains: q } },
        { telefonMobil: { contains: q } },
        { angehoerigerNachname: { contains: q, mode: 'insensitive' } },
        { angehoerigerVorname: { contains: q, mode: 'insensitive' } },
      ],
    });
  }
  if (f.standort) and.push({ standortId: f.standort });
  if (f.status) and.push({ status: f.status as never });
  if (f.pflegegrad) and.push({ pflegegrad: f.pflegegrad as never });
  if (f.mitarbeiter) and.push({ erstelltVonId: f.mitarbeiter });
  if (f.von || f.bis) {
    and.push({
      createdAt: {
        ...(f.von ? { gte: new Date(f.von) } : {}),
        ...(f.bis ? { lte: new Date(f.bis + 'T23:59:59') } : {}),
      },
    });
  }

  return and.length ? { AND: and } : {};
}

export function filterFromSearchParams(sp: URLSearchParams): InteressentFilter {
  return {
    q: sp.get('q') ?? undefined,
    standort: sp.get('standort') ?? undefined,
    status: sp.get('status') ?? undefined,
    pflegegrad: sp.get('pflegegrad') ?? undefined,
    mitarbeiter: sp.get('mitarbeiter') ?? undefined,
    von: sp.get('von') ?? undefined,
    bis: sp.get('bis') ?? undefined,
  };
}
