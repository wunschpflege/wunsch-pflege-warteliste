#!/bin/sh
set -e

echo "=== Release: Datenbankmigrationen ==="

# Markiere Init-Migration als angewendet (falls DB durch db push erstellt wurde)
npx prisma migrate resolve --applied 20260602000000_init 2>/dev/null || true
npx prisma migrate resolve --applied 20260603000000_standort_address 2>/dev/null || true
npx prisma migrate resolve --applied 20260603000002_settings 2>/dev/null || true
npx prisma migrate resolve --applied 20260603000003_standort_ort 2>/dev/null || true

# Neue Migrationen anwenden
echo "Applying migrations..."
npx prisma migrate deploy

echo "Running seed..."
npx tsx prisma/seed.ts

echo "=== Release abgeschlossen ==="
