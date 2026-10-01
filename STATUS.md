# Stand

Kurzer Status für jede neue Sitzung. Wird nach jeder Änderung fortgeschrieben.
Ausführlicher Hintergrund steht in `AGENTS.md`.

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
