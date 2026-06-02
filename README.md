# Wunsch-Pflege GmbH – Wartelisten-Verwaltung

Eine produktionsreife Webanwendung zur Verwaltung von Wartelisten für freie WG-Plätze.
Mitarbeiter verwalten Interessenten, freie Plätze, Wiedervorlagen/Rückrufe und erhalten
automatische Belegungs­vorschläge – inklusive Rollen- und Rechtesystem, Audit-Trail,
automatischer Datensatz-Historie sowie Export nach CSV, Excel und PDF.

## Technologie-Stack

| Bereich    | Technologie                                              |
|------------|----------------------------------------------------------|
| Frontend   | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS |
| Backend    | Next.js Server Actions + REST API (Route Handlers, Node.js) |
| Datenbank  | PostgreSQL + Prisma ORM (automatische Migrationen)       |
| Auth       | JWT in httpOnly-Cookie (`jose`), Passwort-Hash via `bcryptjs` |
| Deployment | Railway (Nixpacks) + GitHub                              |

---

## 1. Lokale Installation

Voraussetzungen: **Node.js 20+** und eine erreichbare **PostgreSQL**-Datenbank.

```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Umgebungsvariablen anlegen
cp .env.example .env
#   -> DATABASE_URL und AUTH_SECRET in .env eintragen (siehe unten)

# 3. Datenbank-Schema anlegen + Testdaten einspielen
npx prisma migrate dev --name init
npm run seed

# 4. Entwicklungsserver starten
npm run dev
```

Anwendung läuft danach auf `http://localhost:3000`.

### AUTH_SECRET erzeugen

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

---

## 2. Umgebungsvariablen

| Variable               | Pflicht | Beschreibung                                                        |
|------------------------|---------|---------------------------------------------------------------------|
| `DATABASE_URL`         | ✅      | PostgreSQL-Connection-String (von Railway automatisch bereitgestellt) |
| `AUTH_SECRET`          | ✅      | Geheimer Schlüssel für die Session-Signierung (min. 32 Zeichen)     |
| `SESSION_TTL_HOURS`    | –       | Gültigkeit der Anmeldung in Stunden (Standard: 8)                   |
| `SEED_ADMIN_EMAIL`     | –       | E-Mail des initialen Geschäftsführungs-Kontos                       |
| `SEED_ADMIN_PASSWORD`  | –       | Startpasswort des Admin-Kontos                                      |
| `SEED_ADMIN_FIRSTNAME` | –       | Vorname des Admins (für Kürzel)                                     |
| `SEED_ADMIN_LASTNAME`  | –       | Nachname des Admins (für Kürzel)                                    |
| `SEED_DEMO_DATA`       | –       | `true` = Demo-Mitarbeiter/-Interessenten anlegen, sonst `false`     |
| `PORT`                 | –       | Port (von Railway gesetzt)                                          |

> **Wichtig:** `SEED_ADMIN_PASSWORD` nach dem ersten Login ändern. Demodaten in der
> Produktion mit `SEED_DEMO_DATA=false` deaktivieren.

---

## 3. Deployment auf Railway

Die Anwendung ist unmittelbar deploybar. GitHub Pro und Railway Pro werden vorausgesetzt.

1. **Repository auf GitHub anlegen** und Code pushen:
   ```bash
   git init
   git add .
   git commit -m "Initial: Wunsch-Pflege Wartelisten-Verwaltung"
   git branch -M main
   git remote add origin https://github.com/<ORG>/<REPO>.git
   git push -u origin main
   ```

2. **Railway-Projekt erstellen** → *New Project* → *Deploy from GitHub repo* → Repository wählen.

3. **PostgreSQL hinzufügen**: im Railway-Projekt *New* → *Database* → *PostgreSQL*.
   Railway stellt `DATABASE_URL` automatisch als Referenzvariable bereit.

4. **Environment Variables** im App-Service setzen (Tab *Variables*):
   - `DATABASE_URL` → Referenz auf das Postgres-Plugin (`${{Postgres.DATABASE_URL}}`)
   - `AUTH_SECRET` → generierter Schlüssel
   - `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_FIRSTNAME`, `SEED_ADMIN_LASTNAME`
   - `SEED_DEMO_DATA=false` (für Produktion)

5. **Deploy**: Railway baut automatisch via Nixpacks (`nixpacks.toml` / `railway.json`).
   Beim Start läuft `npm run release`:
   - `prisma migrate deploy` – wendet alle Migrationen an
   - `tsx prisma/seed.ts` – legt Standorte + Admin-Konto an (idempotent)

   Danach startet der Next.js-Server. Healthcheck: `GET /api/health`.

Bei jedem Push auf `main` deployt Railway automatisch neu.

---

## 4. GitHub-Struktur

```
wunsch-pflege/
├── prisma/
│   ├── schema.prisma      # Datenbankmodell
│   └── seed.ts            # Standorte, Admin, Demodaten
├── src/
│   ├── app/
│   │   ├── (app)/         # Geschützter Bereich (Dashboard, Warteliste, …)
│   │   ├── api/           # REST-API + Auth + Health + Export
│   │   └── login/         # Anmeldeseite
│   ├── components/        # Wiederverwendbare UI-Komponenten
│   ├── lib/               # Auth, RBAC, Audit, Matching, Validierung, Labels
│   └── middleware.ts      # Session-/Routenschutz
├── railway.json           # Railway-Deployment
├── nixpacks.toml          # Build-/Start-Konfiguration
└── .env.example           # Vorlage für Umgebungsvariablen
```

---

## 5. Rollen- und Rechtesystem

| Funktion                  | Geschäftsführung | PDL | Verwaltung |
|---------------------------|:---------------:|:---:|:----------:|
| Interessenten anlegen/bearb. | ✅ | ✅ | ✅ |
| Interessenten löschen     | ✅ | – | – |
| Freie Plätze verwalten    | ✅ | ✅ | – |
| Wiedervorlagen verwalten  | ✅ | ✅ | ✅ |
| Standorte verwalten       | ✅ | – | – |
| Benutzerverwaltung        | ✅ | – | – |
| Exporte (CSV/Excel/PDF)   | ✅ | ✅ | ✅ |

Das **Mitarbeiterkürzel** wird automatisch aus Vor- und Nachname erzeugt
(Alexander Markus → `AM`). Es wird bei jeder Eintragung, Änderung und Notiz gespeichert.

---

## 6. REST API

Alle Endpunkte erfordern eine gültige Session (Cookie) und prüfen die Rollenrechte.

| Methode | Pfad                          | Beschreibung                          |
|---------|-------------------------------|---------------------------------------|
| GET     | `/api/health`                 | Health-Check (DB-Verbindung)          |
| POST    | `/api/auth/login`             | Anmeldung                             |
| POST    | `/api/auth/logout`            | Abmeldung                             |
| GET     | `/api/interessenten`          | Liste (Filter: `q, standort, status, pflegegrad, mitarbeiter, von, bis, limit`) |
| POST    | `/api/interessenten`          | Anlegen                               |
| GET     | `/api/interessenten/:id`      | Einzeldatensatz inkl. Historie        |
| PATCH   | `/api/interessenten/:id`      | Aktualisieren (mit automatischer Historie) |
| DELETE  | `/api/interessenten/:id`      | Löschen (nur Geschäftsführung)        |
| GET     | `/api/export?format=csv\|xlsx\|pdf` | Export der gefilterten Liste    |

---

## 7. Datensicherung (Backup-Konzept)

- **Automatische Backups:** Railway PostgreSQL erstellt regelmäßige Snapshots.
  Empfehlung: im Postgres-Plugin unter *Settings → Backups* tägliche Backups aktivieren
  und Aufbewahrung passend zur DSGVO-Aufbewahrungsfrist einstellen.
- **Manuelles Backup / Export:**
  ```bash
  pg_dump "$DATABASE_URL" > backup_$(date +%F).sql
  ```
- **Wiederherstellung:**
  ```bash
  psql "$DATABASE_URL" < backup_DATEI.sql
  ```
- Die Anwendung selbst ist zustandslos (Stateless); alle Daten liegen ausschließlich
  in PostgreSQL – ein DB-Backup sichert somit den gesamten Datenbestand.

---

## 8. DSGVO-Hinweise

- Passwörter werden ausschließlich als bcrypt-Hash gespeichert (nie im Klartext).
- Vollständiger **Audit-Trail** (`AuditLog`) protokolliert Anmeldungen, Änderungen und Exporte.
- Jeder Interessenten-Datensatz besitzt eine nachvollziehbare **Historie**
  (wer, wann, welches Feld, alter/neuer Wert).
- Die Anwendung ist per `robots: noindex` von Suchmaschinen ausgeschlossen.
- Datensätze können bei Bedarf archiviert (Status „Archiviert“) oder gelöscht werden.

---

## 9. Testdaten

Mit `SEED_DEMO_DATA=true` werden angelegt:

- **Admin (Geschäftsführung):** `geschaeftsfuehrung@wunsch-pflege.de` / `WunschPflege2026!`
- **PDL:** `alexander.markus@wunsch-pflege.de` (Kürzel `AM`) / `WunschPflege2026!`
- **Verwaltung:** `filiz.bilginer@wunsch-pflege.de` (Kürzel `FB`) / `WunschPflege2026!`
- 9 Standorte, 3 Demo-Interessenten, 3 freie/belegte Plätze, 1 Rückruf.

> Diese Zugangsdaten **nur zum Testen** verwenden und in der Produktion ändern bzw.
> Demodaten deaktivieren.

---

## Lizenz / Nutzung

Erstellt für die interne produktive Nutzung der Wunsch-Pflege GmbH.
