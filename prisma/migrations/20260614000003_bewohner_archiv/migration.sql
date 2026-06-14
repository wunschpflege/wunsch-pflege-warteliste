CREATE TABLE IF NOT EXISTS "BewohnerArchiv" (
  "id"           TEXT NOT NULL,
  "standortId"   TEXT NOT NULL,
  "bewohnerName" TEXT NOT NULL,
  "belegtSeit"   TIMESTAMP(3),
  "auszugAm"     TIMESTAMP(3) NOT NULL,
  "auszugGrund"  TEXT NOT NULL,
  "bemerkung"    TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BewohnerArchiv_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BewohnerArchiv_standortId_fkey" FOREIGN KEY ("standortId") REFERENCES "Standort"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
