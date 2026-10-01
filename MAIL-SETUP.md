# Mail-Versand einrichten

Wie aus `MAIL_MODE=outbox` echter Versand wird. Reihenfolge einhalten — sonst
landen die Mails im Spam und du merkst es erst, wenn der Kunde sich beschwert.

## Grundsatz: eigene Absenderadresse

Mails **nicht** von `inhaber@gmail.com` verschicken, sondern von der Domain des
Kunden, z. B. `anfrage@fliesen-schmidt.de`. Ein Fliesenleger, der eine Mail von
`noreply@resend.com` bekommt, hält sie für Spam und ruft lieber an.

---

## Schritt 1 — Resend-Konto

1. Konto auf [resend.com](https://resend.com) anlegen. **Keine Kreditkarte nötig**
   im Gratisrahmen: 3.000 Mails/Monat, 100/Tag, 3 Domains.
2. Unter *API Keys* einen Key erzeugen. Beginnt mit `re_`.
3. Key notieren — er wird später als `RESEND_KEY` gebraucht.

## Schritt 2 — Domain hinzufügen

Unter *Domains → Add Domain* die Domain eintragen. Resend zeigt danach drei
DNS-Einträge, die in Cloudflare übernommen werden müssen.

> Die Datenhoheit liegt beim Kunden, nicht bei Resend. Für den Einstieg ist das
> vertretbar; bei größeren Kunden eine eigene DNS-Verwaltung vorsehen.

## Schritt 3 — DNS-Einträge eintragen

In Cloudflare: Website der Domain → **DNS** → **Records** → *Add record*.

| Typ | Name | Inhalt | Zwang |
|---|---|---|---|
| TXT | `@` | `v=spf1 include:amazonses.com ~all` | ja |
| TXT | `resend._domainkey` | *(Wert von Resend kopieren)* | ja |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:domain@…` | empfohlen |

Anschließend bei Resend *Verify* drücken. Propagation dauert meist 5–30 Minuten,
bei manchen Providern länger.

**Woran liegt es, wenn Mails im Spam landen:**

| Fehler | Wirkung |
|---|---|
| SPF fehlt | Empfänger weiß nicht, ob der Absender echt ist |
| DKIM fehlt | Mail gilt als möglicherweise gefälscht |
| DMARC `p=reject` vor DKIM eingerichtet | **Alle** Mails werden abgewiesen |

## Schritt 4 — Prüfen

```bash
node server/mail-check.js --domain firma.de --to du@deine-mail.de
```

Der Key kommt aus `RESEND_KEY`, alternativ mit `--key re_…`.

Das Skript macht vier Dinge und sagt dir zu jedem, ob es stimmt:

1. **SPF** per DNS abfragen
2. **DKIM** per DNS abfragen
3. **DMARC** per DNS abfragen
4. **Domain-Status bei Resend** abgleichen und eine echte Testmail senden

Nur prüfen, ohne Testmail: `--no-send`

Ausgabe mit `FEHL` bedeutet: noch nicht live schalten. `warn` heißt: läuft, aber
nicht ausgereift.

## Schritt 5 — Server starten

```bash
MAIL_MODE=resend \
RESEND_KEY=re_deinekey \
MAIL_FROM="Website <anfrage@firma.de>" \
MAIL_TO="inhaber@firma.de" \
node server/server.js
```

Ab jetzt schickt **jede** Formularanfrage automatisch eine Mail an `MAIL_TO`.

Prüfen, was gerade konfiguriert ist:

```bash
curl -s http://127.0.0.1:8765/api/status
```

## Optional: Bestätigung an den Kunden

Aktuell geht die Mail nur an den Betrieb. Viele Kunden erwarten außerdem eine
Bestätigung an ihre eigene Adresse. Zwei zusätzliche Zeilen in `server.js`:

```js
to: [MAIL_TO, entry.mail]
```

Vorteil: Der Kunde sieht, dass seine Anfrage angekommen ist, und ruft nicht
deshalb an. Das senkt die Zahl der Anrufe spürbar.

Nachteil: doppeltes Volumen — bei 15 Mails im Monat weiterhin gratis, aber der
Punkt muss im Erstgespräch benannt werden.

---

## Was das kostet

| Posten | Betrag |
|---|---|
| Resend, 3.000 Mails/Monat | 0 € |
| Cloudflare DNS + Hosting | 0 € |
| Domain, pro Jahr | 12–25 € |
| **Für 15 Kunden mit zusammen ~225 Mails/Monat** | **0 €** |

Die Mails sind nicht der Kostenpunkt. Der Wert liegt darin, dass eine Anfrage
nicht in einem ungeöffneten Postfach verschwindet.
