# Steinwerk — Demo-Website mit Anfragen-Protokoll

Verkaufs-Demo für lokale Handwerksbetriebe. Statische Website plus
dependency-freier Node-Server, der Formulanfragen entgegennimmt, protokolliert
und per E-Mail meldet.

## WICHTIG: Memory-Pflicht

**Nach jeder Änderung `STATUS.md` aktualisieren.** Es enthält den aktuellen
Stand, offene Punkte und bewusste Entscheidungen. Ohne diese Datei beginnt die
nächste Sitzung bei null.

Format: unter „Stand" den Zeitpunkt und die Änderung eintragen, bei größeren
Umbaustufen auch „Entscheidungen" und „Offen" anfassen. Nicht ausführlich
nacherzählen — nur was eine neue Sitzung wirklich braucht.

## Sicherheitsregeln

- **`.env` niemals mit dem Read-Werkzeug öffnen.** Enthält den Resend-Key.
  Nur über `node -e "require('./server/env').load(); …"` gezielt prüfen und
  dabei ausschließlich Metadaten ausgeben (vorhanden ja/nein, Länge), niemals
  den Wert selbst.
- Keys gehören in `.env`, nie in `AGENTS.md`, `STATUS.md` oder ins Chatprotokoll.
- `.env` und `server/data/` sind in `.gitignore`.

## Versionsverwaltung

Repository liegt in diesem Ordner. Nach jeder abgeschlossenen Änderung committen,
damit jederzeit ein Earlier-Stand wiederherstellbar ist.

```bash
git add -A && git commit -m "kurze, konkrete Beschreibung"
git log --oneline          # Verlauf
git checkout HEAD~1 -- <datei>   # eine Datei zurückholen
```

Vor dem Commit prüfen, dass `.env` nicht mitwandert — `git status` muss sie als
ignoriert zeigen, nie als zum Hinzufügen vorgemerkt.

## Starten

```bash
./start.sh                              # Website + Admin, Port 8765
node server/server.js                   # nur der Server
node server/mail-check.js               # Versand prüfen
node --check server/server.js            # Syntax prüfen
```

Port 8765, nur `127.0.0.1`. `ADMIN_TOKEN` aus `.env` wird beim Ausliefern von
`admin.html` eingesetzt; von außerhalb liefert der Server dort 403.

In der **Cloud** läuft der Adminbereich über `functions/admin/[[path]].js`:
Anmeldung mit Passwort, danach signiertes HttpOnly-Cookie. Dort wird kein
Token in die HTML geschrieben, `admin.html` darf deshalb kein `var TOKEN`
enthalten.

## Aufbau

```
index.html          Landingpage, Formular → POST /api/anfrage
konfigurator.html   Baukasten fürs Kundengespräch, Vorschau = iframe auf index.html
admin.html          Protokoll-Ansicht, Token wird serverseitig ersetzt
impressum.html      Rechtstext-Muster, Platzhalter
datenschutz.html    Rechtstext-Muster, Platzhalter
css/styles.css      Alles in reinem CSS, keine externen Bilder oder Webfonts
css/konfigurator.css  Nur die Werkzeugansicht, greift nicht in styles.css ein
js/main.js          Navigation, Galerie, Vorher/Nachher, Formular-Fetch
js/konfigurator.js  Modul-Auswahl, Preis, Vollbild, Vorschau-Breiten
server/server.js    HTTP-Server, Validierung, Protokoll, Mail, SMS
server/env.js       .env-Parser, keine Abhängigkeiten
server/mail-check.js DNS-/Resend-Prüfung und Testversand
MAIL-SETUP.md       DNS-Einträge zum Abtippen
ANGEBOT.md          Angebotsvorlage 3.500 € mit ROI-Begründung
.env                Konfiguration und Geheimnisse — nie committen
```

## Cloudflare-Version (Livebetrieb)

Zweite, dateisystemlose Variante für den Produktivbetrieb. Der Node-Server
oben bleibt für lokale Entwicklung und Vorführung unverändert.

```
functions/api/[[path]].js   Pages Function, Gegenstück zu server/server.js
functions/admin/[[path]].js Anmeldung, Cookie-Session, wird vorangestellt
cloudflare/static/          Build-Output, Kopie der HTML/CSS/JS-Dateien
cloudflare/migrations/      D1-Schema
wrangler.toml               Projektkonfiguration
```

`functions/admin/[[path]].js` wird **vor** `functions/api/[[path]].js`
angehängt, weil es die Hilfsfunktionen für die Session mitbringt.

**`ADMIN_TOKEN` ist das Admin-Passwort, kein API-Schlüssel.** Grundregeln:

- Niemals in HTML, JavaScript oder eine URL schreiben.
- Wird nur gegen das Passwort beim Login und beim Token-Abgleich benutzt.
- Ohne gesetzten Wert bleibt der Adminbereich zu (`passwortGueltig` gibt
  `false`), nicht offen.

Der Admin-Pfad ist in der Cloud `/admin`, nicht `/admin.html`: Pages leitet
`.html` auf die Datei ohne Endung um und liefert sie dann als statische Datei
aus, wodurch jede Function für diesen Pfad umgangen würde.

**Functions müssen unter `./functions/` im Projektwurzelverzeichnis liegen**,
nicht unter `cloudflare/functions/`. Pages findet sie sonst nicht.

Lokal testen:

```bash
npx wrangler@latest d1 migrations apply steinwerk-anfragen --local
npx wrangler@latest pages dev cloudflare/static
```

**Nicht `--d1=DB` verwenden** — der Schalter legt eine getrennte lokale
Datenbank an, und die Tabelle aus der Migration fehlt dort. Die Bindung kommt
aus `wrangler.toml`.

Konfiguration kommt in der Cloud aus Secrets, nicht aus `.env`:
`npx wrangler pages secret put RESEND_KEY`.

## Konventionen

- **Keine npm-Abhängigkeiten.** Nur Node-Standardbibliothek. Bei neuen
  Bedürfnissen erst prüfen, ob `http`, `fs`, `crypto` oder `fetch` reichen.
- Node 18+ wird vorausgesetzt (globaler `fetch`), lokal läuft 22.x.
- Alles auf Deutsch, auch Bezeichner, Kommentare und Fehlermeldungen.
- HTML ist statisch und ohne Build-Schritt direkt im Browser lauffähig.
- CSS-Fliesenmuster statt Bilddateien, damit die Seite ohne Cloudflare
  überall gleich aussieht.

## Versand

`MAIL_MODE` in `.env`: `outbox` (nur Datei) oder `resend` (echt).

Aktuell läuft `resend` mit `onboarding@resend.dev` — Resends Testadresse.
**Die darf nur an die Kontoadresse senden.** Für Mails an Kundenadressen muss
`MAIL_DOMAIN` gesetzt sein, dann bildet der Server `MAIL_FROM` automatisch.

Das Protokoll wird **immer vor** dem Mailversand geschrieben. Fällt der Versand
aus, ist die Anfrage trotzdem nicht verloren.

## Noch nicht erledigt

- Eigene Domain + DNS-Einträge (SPF, DKIM, DMARC) — nötig vor dem Livegang
- Reale Kontaktdaten in `impressum.html` und `datenschutz.html`
- Datenschutz-Bestätigung des Formulars wird serverseitig nicht protokolliert
- Antwort auf im Chat, ob eine Kopie an den Kunden mitversendet werden soll
- Rate-Limiting für Login und Formular: die In-Memory-Sperre greift pro
  Cloudflare-Instanz und schützt im Produktivbetrieb nicht
