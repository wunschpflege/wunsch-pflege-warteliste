ALTER TABLE "Standort" ADD COLUMN "strasse" TEXT;
ALTER TABLE "Standort" ADD COLUMN "hausnummer" TEXT;
ALTER TABLE "Standort" ADD COLUMN "plz" TEXT;
ALTER TABLE "Standort" DROP COLUMN IF EXISTS "adresse";
