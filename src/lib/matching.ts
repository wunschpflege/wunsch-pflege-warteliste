import 'server-only';
import { prisma } from './prisma';
import type { Platz, Interessent, Standort } from '@prisma/client';

const PRIO_SCORE: Record<string, number> = { DRINGEND: 40, HOCH: 25, NORMAL: 10, NIEDRIG: 0 };
const PG_RANK: Record<string, number> = { KEINER: 0, PG1: 1, PG2: 2, PG3: 3, PG4: 4, PG5: 5 };

export interface MatchResult {
  interessent: Interessent & { standort: Standort | null };
  score: number;
  gruende: string[];
}

/**
 * Schlaegt passende Interessenten fuer einen frei werdenden Platz vor.
 * Kriterien: gewuenschter Standort, Pflegegrad, Prioritaet,
 * Eintragsdatum (je aelter desto hoeher) und besondere Anforderungen.
 */
export async function matchKandidaten(platz: Platz): Promise<MatchResult[]> {
  const kandidaten = await prisma.interessent.findMany({
    where: { status: { in: ['NEUE_ANFRAGE', 'WARTELISTE', 'BESICHTIGUNG_GEPLANT', 'PLATZ_ANGEBOTEN'] } },
    include: { standort: true },
  });

  const now = Date.now();
  const results: MatchResult[] = kandidaten.map((k) => {
    const gruende: string[] = [];
    let score = 0;

    if (platz.standortId && k.standortId === platz.standortId) {
      score += 35;
      gruende.push('Gewünschter Standort passt');
    }

    score += PRIO_SCORE[k.prioritaet] ?? 0;
    if (k.prioritaet === 'DRINGEND' || k.prioritaet === 'HOCH') {
      gruende.push(`Priorität: ${k.prioritaet.toLowerCase()}`);
    }

    // Hoeherer Pflegegrad -> dringenderer Bedarf
    score += (PG_RANK[k.pflegegrad] ?? 0) * 3;

    // Wartezeit: pro 30 Tage 1 Punkt (max. 30)
    const tage = Math.floor((now - new Date(k.createdAt).getTime()) / 86_400_000);
    const warteScore = Math.min(30, Math.floor(tage / 30));
    score += warteScore;
    if (tage > 30) gruende.push(`Seit ${tage} Tagen auf der Liste`);

    // Gewuenschter Einzug bereits erreicht / nah
    if (k.gewuenschterEinzug && platz.freiAb) {
      if (new Date(k.gewuenschterEinzug) <= new Date(platz.freiAb)) {
        score += 10;
        gruende.push('Wunschtermin liegt vor Frei-ab-Datum');
      }
    }

    if (k.besonderheiten) gruende.push('Besonderheiten beachten');

    return { interessent: k, score, gruende };
  });

  return results.sort((a, b) => b.score - a.score).slice(0, 10);
}
