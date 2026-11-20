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
| `INAKTIV_MINUTEN`      | –       | Automatische Abmeldung nach so vielen Minuten ohne Eingabe (Standard: 15; erlaubt 0.1–240, sonst 15), siehe „Automatische Abmeldung“ |
| `SEED_ADMIN_EMAIL`     | –       | E-Mail des initialen Geschäftsführungs-Kontos                       |
| `SEED_ADMIN_PASSWORD`  | –       | Startpasswort des Admin-Kontos                                      |
| `SEED_ADMIN_FIRSTNAME` | –       | Vorname des Admins (für Kürzel)                                     |
| `SEED_ADMIN_LASTNAME`  | –       | Nachname des Admins (für Kürzel)                                    |
| `SEED_DEMO_DATA`       | –       | `true` = Demo-Mitarbeiter/-Interessenten anlegen, sonst `false`     |
| `PORTAL_SECRET`        | –       | Anbindung an das Portal (min. 32 Zeichen), siehe Abschnitt 10       |
| `PORTAL_ANMELDUNG_URL` | –       | Anmeldung nur noch über das Portal (Adresse des Portals), siehe Abschnitt 10 |
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
| POST    | `/api/auth/aktiv`             | „Ich bin noch da“ – verlängert die Sitzung (schickt die Oberfläche selbst) |
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

## 10. Anbindung an das Portal

Die Warteliste kann an das zentrale Wunsch-Pflege Portal angebunden werden (App-ID `warteliste`).
Dazu im App-Service die Variable `PORTAL_SECRET` setzen (gemeinsames Geheimnis, **mindestens
32 Zeichen**) und denselben Wert im Portal als `APP_WARTELISTE_SECRET` eintragen. Ohne diese
Variable sind alle Endpunkte abgeschaltet (`404`) und die Anwendung verhält sich wie bisher.

| Methode | Pfad                                   | Beschreibung |
|---------|----------------------------------------|--------------|
| GET     | `/api/portal/summary`                  | Kennzahlen für das Portal (nur Anzahlen, keine Namen). Aufruf mit `Authorization: Bearer <PORTAL_SECRET>`. |
| GET     | `/api/portal/sso?token=<JWT>&ziel=<pfad>` | Automatische Anmeldung: Das Portal schickt ein 60 Sekunden gültiges, nur einmal verwendbares Token (HS256). `sub` muss der **Benutzername** eines aktiven Kontos sein (Groß-/Kleinschreibung egal). |
| GET     | `/api/portal/rollen`                   | Rollen für die Auswahl im Portal: `VERWALTUNG` (Standard), `PDL`, `GESCHAEFTSFUEHRUNG`. Aufruf mit Bearer wie oben. |
| GET     | `/api/portal/konto?benutzername=<name>` | Auskunft, ob es das Konto gibt, ob es aktiv ist und welche Rolle es hat (gleiche Suche wie bei der Anmeldung). Aufruf mit Bearer wie oben. |
| POST    | `/api/portal/konto`                    | Legt ein Konto an (`benutzername`, `vorname`, `nachname`, `rolle` als JSON). Gibt es das Konto schon, wird nichts geändert. Aufruf mit Bearer wie oben. |
| GET     | `/api/portal/aufgaben?benutzername=<name>` | Offene Punkte hinter den Kennzahlen für „Was ist zu tun“ im Portal, passend zu den Rechten des Kontos. Ohne Namen und Freitexte. Aufruf mit Bearer wie oben. |
| GET     | `/api/portal/konten`                   | Alle Konten (auch gesperrte) mit Rolle und letzter Anmeldung für die Sicherheitsübersicht; `nur_portal` zeigt, ob die PIN-Anmeldung abgeschaltet ist. Nie PIN-Hashes. Aufruf mit Bearer wie oben. |
| POST    | `/api/portal/konto/sperren`            | Sperrt (deaktiviert) ein Konto (`benutzername` als JSON), z. B. wenn jemand das Unternehmen verlässt. Beliebig oft wiederholbar. Aufruf mit Bearer wie oben. |

- Die Anmeldung über das Portal erzeugt dieselbe Session wie der PIN-Login und wird im
  Audit-Trail als „Anmeldung über Portal“ protokolliert. Rollen und Rechte kommen weiterhin
  ausschließlich aus der Warteliste.
- Deaktivierte Konten werden nicht angemeldet; bei jedem Fehler landet man auf der normalen
  Anmeldeseite.
- Konten aus dem Portal: Das Kürzel wird wie in der Benutzerverwaltung aus dem Namen gebildet, der
  Benutzername klein gespeichert (3–50 Zeichen: a–z, Ziffern, dazwischen `.`, `-` oder `_`). Das Konto
  bekommt **keine PIN** und kann sich zunächst nur über das Portal anmelden; eine PIN vergibt bei
  Bedarf die Benutzerverwaltung. Vorhandene Konten werden nie verändert oder reaktiviert. Im
  Audit-Trail steht der Eintrag mit dem Vermerk „über Portal“ (ohne Kürzel, da niemand angemeldet ist).
  Achtung: Beim Bearbeiten in der Benutzerverwaltung wird der Benutzername wie gewohnt neu aus
  Vor- und Nachname gebildet (`p.muster`); weicht der im Portal gewählte Name davon ab, muss er
  danach im Portal angepasst werden.
- Sperren aus dem Portal: Das Konto wird genauso deaktiviert wie in der Benutzerverwaltung
  („Deaktivieren“); im Audit-Trail steht „deaktiviert – über Portal“. Die Sperre wirkt **sofort**:
  Die Warteliste prüft bei jeder Anfrage in der Datenbank, ob das Konto noch aktiv ist, eine laufende
  Sitzung endet also mit dem nächsten Klick (das gilt auch beim Deaktivieren in der
  Benutzerverwaltung; eine geänderte Rolle gilt ebenfalls sofort). Das **letzte aktive Konto der
  Geschäftsführung** wird nicht gesperrt (Antwort `409`), damit sich niemand aussperrt. Entsperrt
  wird nur in der Benutzerverwaltung der Warteliste, nie über das Portal.
- Gemeldete Kennzahlen: überfällige Wiedervorlagen, überfällige Rückmeldungen, in 7 Tagen
  fällige Wiedervorlagen, unbearbeitete neue Anfragen, Wartezeit über 3 Monate, freie Plätze.
- Aufgabenliste (`/api/portal/aufgaben`): dieselben Quellen und dieselbe Einstufung wie die Kennzahlen.
  Überfällige und bald fällige Wiedervorlagen sowie überfällige Rückmeldungen erscheinen einzeln (je
  höchstens 15, der Rest als „n weitere …“), neue Anfragen, lange Wartezeit und freie Plätze als je ein
  Eintrag mit Anzahl. **Datenschutz:** Es werden nur Art, Datum, Anzahl und Standortname gemeldet – keine
  Namen von Interessenten, Angehörigen oder Mitarbeitenden, keine Gesundheitsangaben und auch nicht der
  frei eingegebene Titel einer Wiedervorlage. Rechte: Wiedervorlagen nur mit „Wiedervorlagen verwalten“,
  Rückmeldungen/Anfragen/Wartezeit nur mit „Interessenten ansehen“ (Berechtigungsmatrix unter
  Einstellungen); freie Plätze sieht jedes aktive Konto.
- **Anmeldung nur noch über das Portal:** Ist `PORTAL_ANMELDUNG_URL` gesetzt (gültige `https://`-Adresse
  des Portals, lokal auch `http://localhost`) und `PORTAL_SECRET` gültig, zeigt die Anmeldeseite statt
  Benutzername/PIN den Knopf „Über das Portal anmelden“ (`<Adresse>/go/warteliste`), `/api/auth/login`
  lehnt jede PIN-Anmeldung mit `403` ab, und „PIN ändern“ im Profil entfällt. Die Benutzerverwaltung
  (einschließlich Start-PIN) bleibt unverändert. Vorher prüfen, dass jedes Konto im Portal mit seinem
  Benutzernamen der Warteliste verknüpft ist – sonst kommt die Person nicht mehr hinein.
  **Zurückschalten:** Variable löschen und neu starten; die PINs sind unverändert gespeichert.

---

## Lizenz / Nutzung

Erstellt für die interne produktive Nutzung der Wunsch-Pflege GmbH.

---

## Automatische Abmeldung nach Inaktivität

Wer **15 Minuten** nichts eingibt, wird automatisch abgemeldet (Schutz für unbeaufsichtigte Geräte).
Die Dauer steht in `INAKTIV_MINUTEN` (Standard 15, erlaubt 0.1 bis 240; kleine Werte nur zum Testen).

- **Serverseitig:** Jede Anmeldung ist eine Zeile in der Tabelle `Sitzung` mit dem Zeitpunkt der letzten
  Aktivität (geschrieben höchstens alle 30 Sekunden). Ist er älter als die Dauer, ist die Sitzung
  beendet – das Cookie ist dann wertlos: Seiten leiten zur Anmeldung um, API-Routen antworten mit
  `401` und `code: "inaktiv"`. `SESSION_TTL_HOURS` gilt daneben weiter; es zählt die kürzere Frist.
- **Aktivität** sind Seitenaufrufe, Server-Actions und API-Anfragen, die aus Eingaben entstehen.
  Nicht mitgezählt werden Anfragen, die die Oberfläche von selbst schickt: Kopf `X-Hintergrund: 1`
  (künftige Hintergrund-Abfragen so kennzeichnen; derzeit gibt es keine). Das Vorausladen verlinkter
  Seiten durch Next.js führt keine Sitzungsprüfung aus und verlängert die Sitzung deshalb nicht.
- **Im Browser** (`src/components/InaktivWaechter.tsx`): Tippen, Klicken, Antippen und Scrollen werden
  höchstens einmal pro Minute an `POST /api/auth/aktiv` gemeldet und über `localStorage` mit anderen
  Tabs geteilt. 60 Sekunden vor Ablauf erscheint „Bist du noch da?“ mit Zähler und dem Knopf
  „Angemeldet bleiben“; danach wird abgemeldet und die Anmeldeseite zeigt den Hinweis.
- **Nicht betroffen:** die Portal-Schnittstelle `/api/portal/*` (eigene Prüfung per `PORTAL_SECRET`);
  die Anmeldung über das Portal erzeugt wie bisher eine frische Sitzung.
- Nach der Umstellung müssen sich alle einmal neu anmelden (alte Cookies kennen keine Sitzung).
- Formulare werden nicht zwischengespeichert: Wer den Hinweis übersieht, verliert nicht gespeicherte Eingaben.
