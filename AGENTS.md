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

## Aufbau

```
index.html          Landingpage, Formular → POST /api/anfrage
admin.html          Protokoll-Ansicht, Token wird serverseitig ersetzt
impressum.html      Rechtstext-Muster, Platzhalter
datenschutz.html    Rechtstext-Muster, Platzhalter
css/styles.css      Alles in reinem CSS, keine externen Bilder oder Webfonts
js/main.js          Navigation, Galerie, Vorher/Nachher, Formular-Fetch
server/server.js    HTTP-Server, Validierung, Protokoll, Mail, SMS
server/env.js       .env-Parser, keine Abhängigkeiten
server/mail-check.js DNS-/Resend-Prüfung und Testversand
MAIL-SETUP.md       DNS-Einträge zum Abtippen
.env                Konfiguration und Geheimnisse — nie committen
```

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
- `ADMIN_TOKEN` ist schwach; vor Produktivbetrieb ersetzen
- Datenschutz-Bestätigung des Formulars wird serverseitig nicht protokolliert
- Antwort auf im Chat, ob eine Kopie an den Kunden mitversendet werden soll
