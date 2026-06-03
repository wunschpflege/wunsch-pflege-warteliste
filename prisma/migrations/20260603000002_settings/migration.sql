CREATE TABLE "SystemSettings" (
  "key"       TEXT NOT NULL,
  "value"     TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("key")
);
