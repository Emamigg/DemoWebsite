# Stand

Kurzer Status für jede neue Sitzung. Wird nach jeder Änderung fortgeschrieben.
Ausführlicher Hintergrund steht in `AGENTS.md`.

---

## 2026-09-29, 16:50

### Läuft und geprüft

- Website liefert alle Seiten ohne Fehler, `js/main.js` und `server/server.js`
  bestehen `node --check`
- Formular nimmt Anfragen an, schreibt ins Protokoll und meldet per Mail
- Server-Log bestätigt: `{"channel":"resend","status":"gesendet"}`
- **Echter Versand funktioniert** an die eigene Adresse
- Validierung, Honeypot, Rate-Limit (5/10 min), Token-Schutz getestet
- `.env` wird gelesen, Shell-Variablen haben Vorrang
- `mail-check.js` prüft SPF, DKIM, DMARC und den Testversand

### Konfiguration

`MAIL_MODE=resend`, `MAIL_TO` = Kontoadresse des Nutzers.
`MAIL_FROM` steht vorläufig auf `onboarding@resend.dev`.
`MAIL_DOMAIN` ist leer.

Der Resend-Key ist ein Standard-Key mit Sendeberechtigung — er kann keine
Domains lesen. Deshalb meldet `mail-check.js` dort bewusst `ok` und nicht
`FEHL`; Domains sind nur im Dashboard sichtbar.

### Offen

1. **Domain und DNS** — nötig, bevor Mails an Kundenadressen gehen. `MAIL_DOMAIN`
   in `.env` eintragen, danach `node server/mail-check.js --domain …`.
2. **Rechtstexte** — `impressum.html` und `datenschutz.html` enthalten
   Platzhalter. DDG verlangt eine echte Adresse.
3. **Kundeneingaben** — Rechnungsdaten, Telefon, Adresse, Domain des Kunden.
4. **Kundenkopie** — offen, ob der Interessent eine Bestätigung an seine eigene
   Adresse bekommen soll. Zwei Wörter in `server.js:107`, Entscheidung offen.
5. **Datenschutz-Bestätigung** — das Formular verlangt sie, das Protokoll
   speichert sie nicht.
6. **Versandweg der Kundendaten** — gehostet beim Kunden, beim Anbieter oder
   zentral beim Anbieter. Fachlich zu entscheiden.

### Bewusste Entscheidungen

- Kein KI-Agent, sondern ein deterministischer Pfad Formular → Protokoll → Mail.
  Nachvollziehbar, testbar, günstiger im Betrieb.
- Kein npm. Alles Node-Standardbibliothek, damit beim Kunden nichts installiert
  werden muss.
- Adminbereich nur von `127.0.0.1`, sonst 403. Das ersetzt echte Authentifizierung
  für den Produktivbetrieb nicht.
- Nischenwahl Fliesen und Badsanierung: hoher Auftragswert, visuelle Produkte,
  klares ROI-Versprechen.
