# Stand

Kurzer Status für jede neue Sitzung. Wird nach jeder Änderung fortgeschrieben.
Ausführlicher Hintergrund steht in `AGENTS.md`.

---

## 2026-10-01, 10:05

### Cloudflare-Port abgeschlossen und getestet

Lokal über `wrangler pages dev` mit echter D1-Datenbank geprüft:

| Prüfung | Ergebnis |
|---|---|
| Status-API | 200, Protokoll lesbar |
| Gültige Anfrage | angelegt, Mail `resend: gesendet` |
| Ungültige Daten | 422 mit Feldmeldungen |
| Honeypot | `id: blocked`, kein Eintrag |
| Falscher Token | 401 |
| Richtiger Token | 200 mit Einträgen |

**Zwei Fehler beim Umstellen gefunden und behoben:**

1. Functions lagen unter `cloudflare/functions/`. Pages findet sie nur unter
   `./functions/` im Projektwurzelverzeichnis, deshalb war die API nicht
   erreichbar. Liegt jetzt korrekt.
2. `--d1=DB` legt eine *andere* lokale Datenbank an als die Migration.
   Deshalb Tabelle nicht gefunden. Lösung: Bindung aus `wrangler.toml`
   verwenden, Migration und Dev-Server teilen sich dann den Zustand.

Dazu ein echter Datenverlust-Bug: Im Protokoll war `mail` doppelt belegt –
einmal die E-Mail des Interessenten, einmal der Versandstatus. Die Adresse
des Interessenten wurde dadurch überschrieben und war im Adminbereich nicht
mehr sichtbar. Versandstatus heißt jetzt `mailversand`.

### Live-Betrieb

**Läuft auf https://steinwerk-demo.pages.dev**

D1-Datenbank `steinwerk-anfragen`, Region EEUR, Migration angewendet.
Secrets über `wrangler pages secret put` gesetzt, nichts davon im Repository:
`RESEND_KEY`, `MAIL_FROM`, `MAIL_TO`, `ADMIN_TOKEN`, `MAIL_MODE`.

Aus der Cloud geprüft:

| Prüfung | Ergebnis |
|---|---|
| Status-API | 200, `mailMode: resend` |
| Gültige Anfrage | angelegt, Mail `resend: gesendet` |
| Ungültige Daten | 422 |
| Honeypot | `id: blocked` |
| Falscher Token | 401 |
| Datenbankinhalt | 2 Einträge direkt in D1 bestätigt |

**Ein Fehler beim ersten Deployment:** `database_id` stand noch auf dem
Platzhalter `REPLACE_WITH_DB_ID`, dadurch schlugen Migration und Upload beide
fehl. Nach dem Eintragen der echten UUID lief beides durch.

**Der zweite Fehler war unauffälliger:** Ohne `MAIL_MODE` als Secret fällt die
Funktion auf `outbox` zurück und schreibt nur noch ins Protokoll, ohne Mail
zu senden. Die Seite wirkt dabei völlig gesund und die Anfrage wird mit
`200 OK` quittiert. Deshalb nach dem Umschalten den Mailstatus im Protokoll
prüfen, nicht nur den HTTP-Code.

### Nächster Schritt

Vor der Übergabe an Kunden, in dieser Reihenfolge:

1. **Eigene Domain auf `steinwerk-demo.pages.dev` hängen.** Aktuell steht die
   Seite auf einer `pages.dev`-Adresse, das ist keine echte Domain.
2. **Resend auf die eigene Domain umstellen.** `MAIL_FROM` ist noch
   `onboarding@resend.dev`, damit gehen Mails nur an die Kontoadresse.
   Domain in Resend anlegen, SPF/DKIM/DMARC eintragen, dann `MAIL_FROM` und
   `MAIL_DOMAIN` als Secrets neu setzen.
3. **Cloudflare Access vor `/admin.html`.** Siehe Warnung unten.
4. **Rate-Limiting einrichten.** Siehe Warnung unten.
5. **Rechtstexte mit echten Daten füllen** und die Klausel zur
   Kleinunternehmerregelung prüfen.

### Bekannte Lücken im Live-Betrieb

- **Rate-Limit ist in der Cloud schwächer als lokal.** Die `hits`-Map lebt nur
  so lange wie die Worker-Instanz; Anfragen verteilen sich auf viele
  Instanzen. Für echten Schutz Cloudflare-Rate-Limiting einrichten oder
  Durable Objects verwenden.
- **`/admin.html` ist in der Cloud öffentlich erreichbar.** Nur durch den
  Token geschützt. Vor dem Livegang Cloudflare Access davor setzen.
- **IP-Adressen** werden als SHA-256-Hash gespeichert, nicht im Klartext.

---

## 2026-09-29, 17:20

### Läuft und geprüft

- Website liefert alle Seiten ohne Fehler, `js/main.js` und `server/server.js`
  bestehen `node --check`
- Formular nimmt Anfragen an, schreibt ins Protokoll und meldet per Mail
- Server-Log bestätigt: `{"channel":"resend","status":"gesendet"}`
- **Echter Versand funktioniert** an die eigene Adresse
- Validierung, Honeypot, Rate-Limit (5/10 min), Token-Schutz getestet
- `.env` wird gelesen, Shell-Variablen haben Vorrang
- `mail-check.js` prüft SPF, DKIM, DMARC und den Testversand
- `ADMIN_TOKEN` wird serverseitig in `admin.html` eingesetzt, von außen 403
- Alles liegt auf GitHub: `github.com/Emamigg/DemoWebsite`, 16 Dateien, ohne
  `.env`. Anmeldung läuft über die GitHub-CLI.

### Neu

- `git init` mit zwei Commits als Absicherung gegen Fehler und Abstürze.
- `gh` (GitHub-CLI) per Homebrew installiert und angemeldet. Ab jetzt sind
  Pushes ohne Browser möglich.
- `ANGEBOT.md` — Angebotsvorlage über 3.500 € netto, 45 Stunden zu 75 €/h,
  nachgerechnet und stimmig.

### Konfiguration

`MAIL_MODE=resend`, `MAIL_TO` = Kontoadresse des Nutzers.
`MAIL_FROM` steht vorläufig auf `onboarding@resend.dev`.
`MAIL_DOMAIN` ist leer.

Der Resend-Key ist ein Standard-Key mit Sendeberechtigung — er kann keine
Domains lesen. Deshalb meldet `mail-check.js` dort bewusst `ok` und nicht
`FEHL`; Domains sind nur im Dashboard sichtbar.

### Hostingkosten für den Vertrieb

Geprüft am 29.09.2026:

| Posten | Kosten |
|---|---|
| Cloudflare Pages, Workers, D1 | 0 € (bis 100.000 Anfragen/Tag) |
| Resend | 0 € bis 3.000 Mails/Monat |
| Domain `.de` pro Kunde | 6–7 €/Jahr |

Die **einzige** laufende Ausgabe ist die Domain, und die trägt der Kunde.
Kosten pro Kunde und Jahr: rund 6,50 €. Hosting ist damit kein
Verkaufsargument, sondern eine Fußnote.

### Offen

1. **Backend auf Cloudflare portieren** — der aktuelle Node-Code läuft nicht in
   der Cloud, weil er das Dateisystem nutzt. Ohne Port kein Livebetrieb.
2. **Domain und DNS** — nötig, bevor Mails an Kundenadressen gehen.
3. **Rechtstexte** — `impressum.html` und `datenschutz.html` enthalten
   Platzhalter. DDG verlangt eine echte Adresse.
4. **Adminbereich absichern** — der Schutz über `127.0.0.1` ersetzt keine echte
   Anmeldung für den Produktivbetrieb.
5. **Kundenkopie** — offen, ob der Interessent eine Bestätigung an seine eigene
   Adresse bekommen soll. Zwei Wörter in `server.js`, Entscheidung offen.
6. **Datenschutz-Bestätigung** — das Formular verlangt sie, das Protokoll
   speichert sie nicht.
7. **Rechtshosting** — Auftragsverarbeitungsvertrag mit Resend, Art. 13/14
   DSGVO. Einziger Posten, der die Kalkulation belastet.

### Bewusste Entscheidungen

- Kein KI-Agent, sondern ein deterministischer Pfad Formular → Protokoll → Mail.
- Kein npm. Alles Node-Standardbibliothek, damit beim Kunden nichts installiert
  werden muss.
- Adminbereich nur von `127.0.0.1`, sonst 403.
- Preisargument gegenüber Kunden ist der entgangene Auftrag, nicht der
  technische Aufwand. Ein Auftrag à 18.000 € deckt 3.500 € mehrfach.
- Nischenwahl Fliesen und Badsanierung: hoher Auftragswert, visuelle Produkte,
  klares ROI-Versprechen.
