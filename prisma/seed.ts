import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { buildInitials } from '../src/lib/initials';

const prisma = new PrismaClient();

const STANDORTE = [
  'WG Sölde',
  'WG Sölderholz',
  'WG Aplerbeck',
  'WG Kirchlinde',
  'WG Rahm',
  'WG Wohnpark Rahm',
  'WG Frohlinde',
  'WG Nette',
  'WG Bodelschwingh',
];

async function hashPin(pin: string) {
  return bcrypt.hash(pin, 12);
}

async function uniqueKuerzel(vorname: string, nachname: string): Promise<string> {
  const base = buildInitials(vorname, nachname);
  let candidate = base;
  let n = 1;
  while (await prisma.user.findFirst({ where: { kuerzel: candidate } })) {
    n += 1;
    candidate = `${base}${n}`;
  }
  return candidate;
}

function buildUsername(vorname: string, nachname: string): string {
  const normalize = (s: string) =>
    s.toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]/g, '');
  return `${normalize(vorname)}.${normalize(nachname)}`;
}

async function ensureUser(opts: {
  username: string;
  vorname: string;
  nachname: string;
  role: 'GESCHAEFTSFUEHRUNG' | 'PDL' | 'VERWALTUNG';
  pin: string;
}) {
  const existing = await prisma.user.findUnique({ where: { username: opts.username } });
  if (existing) return existing;
  const kuerzel = await uniqueKuerzel(opts.vorname, opts.nachname);
  return prisma.user.create({
    data: {
      username: opts.username,
      vorname: opts.vorname,
      nachname: opts.nachname,
      kuerzel,
      role: opts.role,
      passwordHash: await hashPin(opts.pin),
    },
  });
}

async function main() {
  console.log('▶ Seed startet …');

  // --- Standorte (idempotent) ---
  for (const name of STANDORTE) {
    await prisma.standort.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`✓ ${STANDORTE.length} Standorte sichergestellt`);

  // --- System-Admin: s.admin / PIN 0000 ---
  const admin = await ensureUser({
    username: 's.admin',
    vorname: 'System',
    nachname: 'Admin',
    role: 'GESCHAEFTSFUEHRUNG',
    pin: process.env.SEED_ADMIN_PIN ?? '0000',
  });
  console.log(`✓ Admin (Geschäftsführung): ${admin.username} / Kürzel ${admin.kuerzel}`);

  // --- Demodaten optional ---
  if ((process.env.SEED_DEMO_DATA ?? 'true') !== 'true') {
    console.log('ℹ Demodaten übersprungen (SEED_DEMO_DATA != true).');
    return;
  }

  const am = await ensureUser({
    username: buildUsername('Alexander', 'Markus'),
    vorname: 'Alexander', nachname: 'Markus', role: 'PDL', pin: '1234',
  });
  const fb = await ensureUser({
    username: buildUsername('Filiz', 'Bilginer'),
    vorname: 'Filiz', nachname: 'Bilginer', role: 'VERWALTUNG', pin: '1234',
  });
  console.log(`✓ Demo-Mitarbeiter: ${am.kuerzel} (${am.username}), ${fb.kuerzel} (${fb.username})`);

  // Nur einmal Demo-Interessenten anlegen
  const vorhandene = await prisma.interessent.count();
  if (vorhandene > 0) {
    console.log('ℹ Es existieren bereits Interessenten – keine Demo-Datensätze ergänzt.');
    return;
  }

  const stMap = new Map((await prisma.standort.findMany()).map((s) => [s.name, s.id]));
  const tage = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

  const demo = [
    {
      vorname: 'Margarete', nachname: 'Hoffmann', geburtsdatum: new Date('1939-04-12'),
      pflegegrad: 'PG3' as const, krankenkasse: 'AOK NORDWEST', wohnsituation: 'Eigene Wohnung, allein',
      gewuenschterEinzug: tage(20), diagnosen: 'Demenz im Frühstadium, Hypertonie',
      mobilitaet: 'Rollator', besonderheiten: 'Mag Gartenarbeit',
      angehoerigerVorname: 'Petra', angehoerigerNachname: 'Hoffmann', angehoerigerBeziehung: 'Tochter',
      angStrasse: 'Lindenweg', angHausnummer: '8', angPlz: '44287', angOrt: 'Dortmund',
      telefonFestnetz: '0231 1234567', telefonMobil: '0170 1112233', email: 'petra.hoffmann@example.de',
      status: 'WARTELISTE' as const, prioritaet: 'HOCH' as const, standort: 'WG Aplerbeck',
      erstelltVonId: am.id,
    },
    {
      vorname: 'Heinrich', nachname: 'Bauer', geburtsdatum: new Date('1945-09-03'),
      pflegegrad: 'PG4' as const, krankenkasse: 'TK', wohnsituation: 'Bei Familie',
      gewuenschterEinzug: tage(10), diagnosen: 'Z. n. Schlaganfall',
      mobilitaet: 'Rollstuhl', besonderheiten: 'Benötigt barrierefreies Zimmer',
      angehoerigerVorname: 'Klaus', angehoerigerNachname: 'Bauer', angehoerigerBeziehung: 'Sohn',
      angStrasse: 'Hauptstraße', angHausnummer: '45', angPlz: '44263', angOrt: 'Dortmund',
      telefonFestnetz: null, telefonMobil: '0171 9988776', email: null,
      status: 'BESICHTIGUNG_GEPLANT' as const, prioritaet: 'DRINGEND' as const, standort: 'WG Sölde',
      erstelltVonId: fb.id,
    },
    {
      vorname: 'Ingrid', nachname: 'Schäfer', geburtsdatum: new Date('1942-12-21'),
      pflegegrad: 'PG2' as const, krankenkasse: 'Barmer', wohnsituation: 'Betreutes Wohnen',
      gewuenschterEinzug: tage(45), diagnosen: 'Diabetes mellitus Typ 2',
      mobilitaet: 'Selbstständig', besonderheiten: null,
      angehoerigerVorname: 'Sabine', angehoerigerNachname: 'Krause', angehoerigerBeziehung: 'Nichte',
      angStrasse: 'Am Markt', angHausnummer: '2', angPlz: '44309', angOrt: 'Dortmund',
      telefonFestnetz: '0231 7654321', telefonMobil: null, email: 'sabine.krause@example.de',
      status: 'NEUE_ANFRAGE' as const, prioritaet: 'NORMAL' as const, standort: 'WG Kirchlinde',
      erstelltVonId: am.id,
    },
  ];

  for (const d of demo) {
    const { standort, ...rest } = d;
    const created = await prisma.interessent.create({
      data: { ...rest, standortId: stMap.get(standort) ?? null },
    });
    await prisma.historie.create({
      data: {
        interessentId: created.id,
        kuerzel: rest.erstelltVonId === am.id ? am.kuerzel : fb.kuerzel,
        mitarbeiter: rest.erstelltVonId === am.id ? `${am.vorname} ${am.nachname}` : `${fb.vorname} ${fb.nachname}`,
        aktion: 'Datensatz angelegt',
      },
    });
  }
  console.log(`✓ ${demo.length} Demo-Interessenten + Historie angelegt`);

  await prisma.platz.createMany({
    data: [
      { standortId: stMap.get('WG Sölde')!, zimmernummer: '12', freiAb: tage(7), geschlechtPref: 'EGAL', belegt: false, bemerkungen: 'Barrierefrei, EG' },
      { standortId: stMap.get('WG Aplerbeck')!, zimmernummer: '4', freiAb: tage(14), geschlechtPref: 'WEIBLICH', belegt: false },
      { standortId: stMap.get('WG Kirchlinde')!, zimmernummer: '7', freiAb: null, geschlechtPref: 'EGAL', belegt: true },
    ],
  });
  console.log('✓ Demo-Plätze angelegt');

  const ersterInteressent = await prisma.interessent.findFirst();
  if (ersterInteressent) {
    await prisma.wiedervorlage.create({
      data: {
        typ: 'RUECKRUF',
        titel: 'Rückruf Angehörige Hoffmann',
        notiz: 'Besichtigungstermin abstimmen',
        faelligAm: tage(1),
        interessentId: ersterInteressent.id,
        zustaendigId: am.id,
        kuerzel: am.kuerzel,
      },
    });
    console.log('✓ Demo-Wiedervorlage angelegt');
  }

  console.log('✅ Seed abgeschlossen.');
}

main()
  .catch((e) => {
    console.error('Seed-Fehler:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
