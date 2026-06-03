import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const STANDORTE = [
  'WG Sölde', 'WG Sölderholz', 'WG Aplerbeck', 'WG Kirchlinde',
  'WG Rahm', 'WG Wohnpark Rahm', 'WG Frohlinde', 'WG Nette', 'WG Bodelschwingh',
];

function buildInitials(vorname: string, nachname: string): string {
  return ((vorname.trim()[0] ?? '') + (nachname.trim()[0] ?? '')).toUpperCase();
}

function buildUsername(vorname: string, nachname: string): string {
  const normalize = (s: string) =>
    s.toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]/g, '');
  return `${normalize(vorname)[0] ?? ''}.${normalize(nachname)}`;
}

async function uniqueKuerzel(vorname: string, nachname: string): Promise<string> {
  const base = buildInitials(vorname, nachname);
  let candidate = base;
  let n = 1;
  while (await prisma.user.findFirst({ where: { kuerzel: candidate } })) {
    candidate = `${base}${++n}`;
  }
  return candidate;
}

async function hashPin(pin: string) {
  return bcrypt.hash(pin, 12);
}

async function main() {
  console.log('▶ Seed startet …');

  // Standorte (idempotent – nur anlegen wenn noch nicht vorhanden)
  for (const name of STANDORTE) {
    await prisma.standort.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`✓ ${STANDORTE.length} Standorte sichergestellt`);

  // Admin-Account (idempotent – nur anlegen wenn noch nicht vorhanden)
  const adminUsername = 's.admin';
  const existing = await prisma.user.findUnique({ where: { username: adminUsername } });
  if (!existing) {
    const kuerzel = await uniqueKuerzel('System', 'Admin');
    await prisma.user.create({
      data: {
        username: adminUsername,
        vorname: 'System',
        nachname: 'Admin',
        kuerzel,
        role: 'GESCHAEFTSFUEHRUNG',
        passwordHash: await hashPin(process.env.SEED_ADMIN_PIN ?? '0000'),
      },
    });
    console.log(`✓ Admin angelegt: ${adminUsername}`);
  } else {
    console.log(`ℹ Admin existiert bereits: ${adminUsername}`);
  }

  console.log('✅ Seed abgeschlossen.');
}

main()
  .catch((e) => { console.error('Seed-Fehler:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
