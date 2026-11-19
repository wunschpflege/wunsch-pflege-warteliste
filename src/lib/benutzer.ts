import 'server-only';
import type { Role, User } from '@prisma/client';
import { prisma } from './prisma';
import { audit } from './audit';
import { buildInitials } from './initials';
import type { SessionUser } from './auth';

/** Eindeutiges Kuerzel erzeugen (bei Kollision Ziffer anhaengen). */
export async function uniqueKuerzel(vorname: string, nachname: string, ignoreId?: string): Promise<string> {
  const base = buildInitials(vorname, nachname);
  let candidate = base;
  let n = 1;
  while (true) {
    const found = await prisma.user.findFirst({ where: { kuerzel: candidate, NOT: ignoreId ? { id: ignoreId } : undefined } });
    if (!found) return candidate;
    n += 1;
    candidate = `${base}${n}`;
  }
}

/**
 * Legt ein Benutzerkonto an und schreibt den Audit-Eintrag. Gemeinsamer Weg fuer die
 * Benutzerverwaltung und das Anlegen ueber das Portal.
 * `actor` ist null, wenn niemand angemeldet ist (Portal); `vermerk` wird an den Audit-Text angehaengt.
 */
export async function benutzerAnlegen(
  daten: { vorname: string; nachname: string; role: Role; username: string; passwordHash: string; kuerzel?: string },
  actor: Pick<SessionUser, 'id' | 'kuerzel'> | null,
  vermerk?: string,
): Promise<User> {
  const { vorname, nachname, role, username, passwordHash } = daten;
  const kuerzel = daten.kuerzel ?? (await uniqueKuerzel(vorname, nachname));
  const created = await prisma.user.create({
    data: { vorname, nachname, role, kuerzel, username, passwordHash },
  });
  await audit(
    actor, 'CREATE', 'User', created.id,
    `${vorname} ${nachname} (${kuerzel}) → ${username}${vermerk ? ` – ${vermerk}` : ''}`,
  );
  return created;
}
