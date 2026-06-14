import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import PlaetzeClient from '@/components/PlaetzeClient';

export const dynamic = 'force-dynamic';

export default async function PlaetzePage() {
  const user = await getSession();
  const canManage = can(user, 'platz.manage');

  const [standorte, plaetze] = await Promise.all([
    prisma.standort.findMany({ where: { aktiv: true }, orderBy: { name: 'asc' } }),
    prisma.platz.findMany({
      orderBy: [{ standort: { name: 'asc' } }, { zimmernummer: 'asc' }],
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Unsere Häuser</h1>
      <PlaetzeClient
        standorte={standorte}
        plaetze={plaetze.map((p) => ({
          id: p.id,
          zimmernummer: p.zimmernummer,
          belegt: p.belegt,
          bewohnerName: (p as any).bewohnerName ?? null,
          belegtSeit: (p as any).belegtSeit ?? null,
          standortId: p.standortId,
        }))}
        canManage={canManage}
      />
    </div>
  );
}
