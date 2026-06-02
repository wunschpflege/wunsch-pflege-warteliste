-- CreateEnum
CREATE TYPE "Role" AS ENUM ('GESCHAEFTSFUEHRUNG', 'PDL', 'VERWALTUNG');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('NEUE_ANFRAGE', 'WARTELISTE', 'BESICHTIGUNG_GEPLANT', 'AUFNAHME_IN_VORBEREITUNG', 'PLATZ_ANGEBOTEN', 'EINGEZOGEN', 'ABGELEHNT', 'ARCHIVIERT');

-- CreateEnum
CREATE TYPE "Prioritaet" AS ENUM ('NIEDRIG', 'NORMAL', 'HOCH', 'DRINGEND');

-- CreateEnum
CREATE TYPE "Pflegegrad" AS ENUM ('KEINER', 'PG1', 'PG2', 'PG3', 'PG4', 'PG5');

-- CreateEnum
CREATE TYPE "Geschlecht" AS ENUM ('MAENNLICH', 'WEIBLICH', 'DIVERS', 'EGAL');

-- CreateEnum
CREATE TYPE "WiedervorlageTyp" AS ENUM ('RUECKRUF', 'WIEDERVORLAGE', 'PLATZ_ERINNERUNG', 'SONSTIGES');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "vorname" TEXT NOT NULL,
    "nachname" TEXT NOT NULL,
    "kuerzel" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VERWALTUNG',
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "letzterLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Standort" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "adresse" TEXT,
    "bemerkungen" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Standort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interessent" (
    "id" TEXT NOT NULL,
    "vorname" TEXT NOT NULL,
    "nachname" TEXT NOT NULL,
    "geburtsdatum" TIMESTAMP(3),
    "pflegegrad" "Pflegegrad" NOT NULL DEFAULT 'KEINER',
    "krankenkasse" TEXT,
    "wohnsituation" TEXT,
    "gewuenschterEinzug" TIMESTAMP(3),
    "diagnosen" TEXT,
    "mobilitaet" TEXT,
    "besonderheiten" TEXT,
    "bemerkungen" TEXT,
    "angehoerigerVorname" TEXT,
    "angehoerigerNachname" TEXT,
    "angehoerigerBeziehung" TEXT,
    "angStrasse" TEXT,
    "angHausnummer" TEXT,
    "angPlz" TEXT,
    "angOrt" TEXT,
    "telefonFestnetz" TEXT,
    "telefonMobil" TEXT,
    "email" TEXT,
    "status" "Status" NOT NULL DEFAULT 'NEUE_ANFRAGE',
    "prioritaet" "Prioritaet" NOT NULL DEFAULT 'NORMAL',
    "standortId" TEXT,
    "erstelltVonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interessent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Historie" (
    "id" TEXT NOT NULL,
    "interessentId" TEXT NOT NULL,
    "kuerzel" TEXT NOT NULL,
    "mitarbeiter" TEXT NOT NULL,
    "aktion" TEXT NOT NULL,
    "feld" TEXT,
    "altWert" TEXT,
    "neuWert" TEXT,
    "zeitpunkt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Historie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Platz" (
    "id" TEXT NOT NULL,
    "standortId" TEXT NOT NULL,
    "zimmernummer" TEXT NOT NULL,
    "freiAb" TIMESTAMP(3),
    "geschlechtPref" "Geschlecht" NOT NULL DEFAULT 'EGAL',
    "belegt" BOOLEAN NOT NULL DEFAULT false,
    "bemerkungen" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Platz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wiedervorlage" (
    "id" TEXT NOT NULL,
    "typ" "WiedervorlageTyp" NOT NULL DEFAULT 'WIEDERVORLAGE',
    "titel" TEXT NOT NULL,
    "notiz" TEXT,
    "faelligAm" TIMESTAMP(3) NOT NULL,
    "erledigt" BOOLEAN NOT NULL DEFAULT false,
    "erledigtAm" TIMESTAMP(3),
    "interessentId" TEXT,
    "zustaendigId" TEXT NOT NULL,
    "kuerzel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wiedervorlage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "zeitpunkt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "kuerzel" TEXT,
    "aktion" TEXT NOT NULL,
    "entitaet" TEXT NOT NULL,
    "entitaetId" TEXT,
    "details" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "User_kuerzel_idx" ON "User"("kuerzel");
CREATE UNIQUE INDEX "Standort_name_key" ON "Standort"("name");
CREATE INDEX "Interessent_nachname_idx" ON "Interessent"("nachname");
CREATE INDEX "Interessent_status_idx" ON "Interessent"("status");
CREATE INDEX "Interessent_standortId_idx" ON "Interessent"("standortId");
CREATE INDEX "Interessent_pflegegrad_idx" ON "Interessent"("pflegegrad");
CREATE INDEX "Historie_interessentId_idx" ON "Historie"("interessentId");
CREATE INDEX "Historie_zeitpunkt_idx" ON "Historie"("zeitpunkt");
CREATE INDEX "Platz_standortId_idx" ON "Platz"("standortId");
CREATE INDEX "Platz_belegt_idx" ON "Platz"("belegt");
CREATE INDEX "Wiedervorlage_faelligAm_idx" ON "Wiedervorlage"("faelligAm");
CREATE INDEX "Wiedervorlage_erledigt_idx" ON "Wiedervorlage"("erledigt");
CREATE INDEX "AuditLog_zeitpunkt_idx" ON "AuditLog"("zeitpunkt");
CREATE INDEX "AuditLog_entitaet_idx" ON "AuditLog"("entitaet");

-- AddForeignKey
ALTER TABLE "Interessent" ADD CONSTRAINT "Interessent_standortId_fkey" FOREIGN KEY ("standortId") REFERENCES "Standort"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Interessent" ADD CONSTRAINT "Interessent_erstelltVonId_fkey" FOREIGN KEY ("erstelltVonId") REFERENCES "User"("id") ON UPDATE CASCADE;
ALTER TABLE "Historie" ADD CONSTRAINT "Historie_interessentId_fkey" FOREIGN KEY ("interessentId") REFERENCES "Interessent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Platz" ADD CONSTRAINT "Platz_standortId_fkey" FOREIGN KEY ("standortId") REFERENCES "Standort"("id") ON UPDATE CASCADE;
ALTER TABLE "Wiedervorlage" ADD CONSTRAINT "Wiedervorlage_interessentId_fkey" FOREIGN KEY ("interessentId") REFERENCES "Interessent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Wiedervorlage" ADD CONSTRAINT "Wiedervorlage_zustaendigId_fkey" FOREIGN KEY ("zustaendigId") REFERENCES "User"("id") ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
