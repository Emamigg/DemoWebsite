# Stand

Kurzer Status für jede neue Sitzung. Wird nach jeder Änderung fortgeschrieben.
Ausführlicher Hintergrund steht in `AGENTS.md`.

---

## 2026-10-01, 14:40

### Website-Konfigurator fertiggestellt und getestet

Neue Seite `konfigurator.html` plus `js/konfigurator.js` und
`css/konfigurator.css`. Zweck: der Kunde wählt am Tisch die Bausteine aus,
sieht die Auswahl sofort in der laufenden Demo und bekommt einen
Preisrichtwert. Die bestehende `index.html` bleibt unverändert — die Vorschau
ist ein gleich-origin-`iframe` darauf.

- 16 Module in vier Gruppen plus fester Grundaufbau (25 Std), Preis 75 €/Std,
  Domain 7 € und Rechtstexte 118 €. Standard 50 Std / 3.875 €, komplett
  65 Std / 5.000 €.
- Drei Vorlagen: Schlank (41 Std), Standard, Komplett.
- „Auswahl ins Angebot übernehmen" hängt die Konfiguration an das bestehende
  Nachrichtenfeld des Demo-Formulars. Kein neues API-Feld, D1 bleibt unberührt.
- Gerätevorschau 1100 / 834 / 390 px, Vollbild mit Fallback für Browser ohne
  API, Druckbogen für die Preisübersicht.

Geprüft mit Chrome headless, teils über das DevTools-Protokoll, weil die
Vollbild-API und Smooth-Scrolling unter Virtual-Time nicht laufen:
26 Preis- und Ausblendungstests, 16 Layout- und Breakpoint-Tests,
17 Vollbildtests, 13 Drucktests, 12 Navigations- und Tastaturtests — alle
grün. Zusätzlich einmal ein echter Anfrage-Versand gegen den lokalen Server
(Status 200); der Testeintrag wurde danach aus dem Protokoll entfernt.

### Entscheidungen

- **Preise sind Richtwerte, kein Festpreis.** Steht so auf dem Knopf, in der
  Druckausgabe und im Angebotstext. Bindend wird nur das schriftliche Angebot.
- **Konfigurator nicht indexierbar.** `noindex, nofollow`, damit die Seite
  nicht in Suchergebnisse auftaucht.
- **Vorschau bleibt immer auf `index.html`.** Klicks auf Impressum,
  Datenschutz oder Anker navigieren nicht aus dem iframe heraus, sonst wäre
  die Auswahl verloren. Anker scrollen intern.
- **`src="./"` statt `src="index.html"`.** Cloudflare leitet `.html` auf die
  Endung-lose URL um; mit relativem Verweis stimmt die Vorschau unter
  `/konfigurator` und beim lokalen Server.

### Gefundene und behobene Fehler

- `doc()` lieferte `null`, bevor das iframe geladen war → das ganze
  `anwenden()` warf und die Preisanzeige blieb auf 0.
- `feldVonSms()` gab ein Element statt eines Arrays zurück.
- `euro()` machte ein `.replace('.', ',')` und traf damit den Tausenderpunkt:
  3.875,00 € wurde zu 3,875,00 €.
- CSS fehlte für `ist-breit`; ohne Fullscreen-API wäre das Panel sichtbar
  geblieben.
- Preset-Knöpfe bekamen nie eine Aktiv-Markierung.
- Die Basis-Gruppe wurde in einer Schleife mit `gruppen.length = 0` gebaut.

### Offen

- Die drei Testskripte lagen nur temporär im Projekt und sind wieder entfernt;
  es gibt noch keinen dauerhaften Testlauf im Repository.
- Der Konfigurator ist nach dem Deployment öffentlich erreichbar, ohne
  Zugangsschutz. Wenn das nicht gewollt ist, gehört er hinter die Admin-Login-
  Route oder auf eine eigene Domain.

## 2026-10-01, 12:30

### Ilshofen-Recherche abgeschlossen, Excel erzeugt

Ziel war eine Leadliste aller Betriebe in Ilshofen ohne brauchbaren
Webauftritt, aus öffentlichen Verzeichnissen.

Quellen: `gewerbeverein-ilshofen.de/mitgliederverzeichnis/` (124 Mitglieder,
113 davon in der Gemeinde) und die Firmenliste der Stadt (43 Einträge,
5 Seiten). Beide wurden als Roh-HTML gesichert, geparst und zusammengeführt;
Ergebnis 112 Betriebe nach Dedupe.

Jeder der zunächst 37 ohne Website geführten Betriebe wurde einzeln geprüft:
Websuche nach Name und Telefon, Abruf von Domain-Kandidaten, Abgleich mit
Impressum und Handelsregister. Ergebnis der Prüfung:

| Status | Betriebe |
|---|---|
| Keine Website, kein Social-Profil | 20 |
| Nur Social Media (LinkedIn) | 1 |
| Domain vorhanden, aber geparkt/leer/503 | 10 |
| Website aktiv | 81 |

Die 16 zunächst ohne Website geführten Betriebe mit inzwischen gefundener
Website sind in die Blätter 2 und 3 verschoben. **Ein Verzeichniseintrag ohne
Website ist kein Beweis für fehlende Internetpräsenz** – bei Autohaus Rössler,
Autohaus Tobies, Bestattungen Rößler, ESSO, Feil Holzbau, Flaschnerei Hofmann,
Gärtnerei Brunner, Kebaphaus, Praxis Haas, Zentrum Mensch, Hohenloher
Bäckerei und RSY Green existierte jeweils eine Domain, die nur nicht im
Verzeichnis stand.

Ausgabe: `recherche/ILSHOFEN-BETRIEBE-ONLINE-STATUS.xlsx` mit fünf Blättern
(Leads ohne Webauftritt, Website defekt, Website aktiv, Gesamt, Methodik).
Roh-HTML und die fertige Excel sind in `.gitignore`, die Skripte und
Zwischen-JSON sind versioniert.

### Aus der Recherche gelernt

- Direkt-Parsen des HTML ist unzuverlässig, der Markdown-Abruf hat den letzten
  Verzeichniseintrag samt Seitenfooter verschluckt. Erst Roh-HTML holen.
- Gleichnamige Betriebe an anderen Orten sind die Hauptfehlerquelle. `autohaus-roessler.de`,
  `th-fliesen.de`, `vermessung-zeh.de`, `architekt-loew.de` und
  `maler-seiter.de` gehören nicht zu den Ilshofer Betrieben. Steht im Blatt
  „Quellen & Methodik".
- Ein Drittel der in den Verzeichnissen genannten Websites war schon bei
  Abruf tot oder geparkt. Für den Vertrieb die stärkere Zielgruppe als die
  Betriebe ganz ohne Domain, weil der Nutzen einmal gezeigt war.
- Bei drei Einträgen ist kein Betrieb dahinter: Heidi Kastenholz (Privatperson
  im Gewerbevereinsvorstand), Zur Katze (Privatinitiative), Primeros e.V.
  (Verein). Als „kein Lead" markiert.
- Eugen Schweikert GmbH & Co. KG i.L. und Caravan Gerner teilen Nummer und
  Domain, die Firma ist in Liquidation.

### Offen in der Recherche

- Gewerbebetriebe, die in keinem der beiden Verzeichnisse stehen, fehlen
  zwangsläufig. Das Gewerbeamt führt keine Online-Daten.
- Telefonnummern und Adressen stammen aus Verzeichnissen und sind teils alt,
  etwa bei der Traurednerin und bei Malergeschäft Seiter (zwei Adressen).
  Vor dem Erstkontakt prüfen.

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
3. **Rate-Limiting einrichten**, für Formular und Login. Siehe Warnung unten.
4. **Rechtstexte mit echten Daten füllen** und die Klausel zur
   Kleinunternehmerregelung prüfen.

### Adminbereich abgesichert

Echte Anmeldung mit Passwort, statt eines Tokens in der URL.

**Der Fund beim Prüfen:** Der Adminbereich war nicht nur ungeschützt, die
geplante Token-Einsetzung hätte in der Cloud nie funktioniert. Pages leitet
`/admin.html` mit 308 auf `/admin` um und liefert dort die Datei direkt aus.
Ein Filter in `functions/api/[[path]].js` sieht nur `/api/*` — die geplante
Token-Injection wurde also nie erreicht. `/admin` war frei zugänglich.

Umgesetzt:

- `functions/admin/[[path]].js` fängt `/admin*` ab, ohne Session gibt es nur
  die Anmeldeseite
- Login per Formular oder JSON an `/api/login`, setzt signiertes HttpOnly-
  Cookie mit HMAC-SHA256 über `ADMIN_TOKEN`, 8 Stunden gültig
- `/api/anfragen` akzeptiert Cookie; Token in der URL bleibt für Skripte
- Abmelden über `/api/logout`, Leiste in `admin.html` ergänzt
- **Kein `var TOKEN` mehr in `admin.html`** — weder lokal noch in der Cloud
- Lokal bleibt es einfach: Schleife an `127.0.0.1`, keine Anmeldung nötig
- `ADMIN_TOKEN` durch 28-Zeichen-Passwort ersetzt, 167 Bit

Aus der Live-Umgebung geprüft:

| Prüfung | Ergebnis |
|---|---|
| `/admin` ohne Anmeldung | nur Anmeldeseite |
| `/admin.html` | 308 auf `/admin` |
| Protokoll ohne Cookie | 401 |
| Cookie mit falscher Signatur | 401 |
| Cookie korrekt signiert, aber abgelaufen | 401 |
| Login mit neuem Passwort | 302, Cookie gesetzt |
| Login mit altem Passwort | 401 |
| Protokoll nach Login | 200 |
| Formular nach der Umstellung | 200, Mail gesendet |

**Lehre daraus:** Der Fehler wäre beim reinen Klicken durch die Oberfläche
nie aufgefallen — die Anmeldeseite sah plausibel aus und die Seite war nur
eben offen. Erst der direkte Aufruf von `/admin.html` in der Cloud hat gezeigt,
dass die Absicherung an der falschen Stelle saß.

### Bekannte Lücken im Live-Betrieb

- **Rate-Limit ist in der Cloud schwächer als lokal.** Die `hits`-Map lebt nur
  so lange wie die Worker-Instanz; Anfragen verteilen sich auf viele
  Instanzen. Für echten Schutz Cloudflare-Rate-Limiting einrichten oder
  Durable Objects verwenden. Das betrifft das Kontaktformular, nicht den
  Adminbereich.
- **Login ist nicht gegen Brute-Force geschützt.** Falsche Passwörter werden
  abgewiesen, aber ohne Sperre. Für den Livegang Rate-Limiting auf `/api/login`
  oder Cloudflare Access setzen.
- **Das Admin-Passwort steht in `.env` im Projektordner.** Auf einem fremden
  Rechner ist damit der Adminbereich offen. Vor Weitergabe des Projekts den
  Ordner bewusst entscheiden, nicht unbedacht mitgeben.
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
