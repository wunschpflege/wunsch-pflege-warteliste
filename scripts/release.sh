#!/bin/sh
set -e

echo "=== Release: Datenbank synchronisieren ==="

# db push synchronisiert das Schema direkt mit der DB (keine Migration-Konflikte)
npx prisma db push --accept-data-loss

echo "=== Seed ausführen ==="
npx tsx prisma/seed.ts

echo "=== Release abgeschlossen ==="
