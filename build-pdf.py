#!/usr/bin/env python3
"""Erzeugt die PDF-Fassung der Positionserklärung.

Bewusst ohne externe Dienste und ohne Abhängigkeiten aus dem Projekt:
reportlab ist auf dem Rechner vorhanden, alles andere braucht es nicht.
"""

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

BREITTE_INHALT = A4[0] - 2 * 22 * mm
SEITENRAND = 22 * mm

TINTE = colors.HexColor("#17130f")
GRAU = colors.HexColor("#6f655c")
HELL = colors.HexColor("#8a7a68")
LINIE = colors.HexColor("#ddd5cb")
HINTERGRUND = colors.HexColor("#f6f2ed")
AKZENT = colors.HexColor("#8a7a68")


def stile():
    basis = getSampleStyleSheet()
    return {
        "titel": ParagraphStyle(
            "titel", parent=basis["Title"], fontName="Helvetica-Bold",
            fontSize=20, leading=24, textColor=TINTE, alignment=TA_LEFT,
            spaceAfter=2 * mm,
        ),
        "untertitel": ParagraphStyle(
            "untertitel", parent=basis["Normal"], fontName="Helvetica",
            fontSize=10.5, leading=14, textColor=GRAU, spaceAfter=6 * mm,
        ),
        "h2": ParagraphStyle(
            "h2", parent=basis["Heading2"], fontName="Helvetica-Bold",
            fontSize=12.5, leading=15, textColor=TINTE,
            spaceBefore=6 * mm, spaceAfter=2 * mm,
        ),
        "h3": ParagraphStyle(
            "h3", parent=basis["Heading3"], fontName="Helvetica-Bold",
            fontSize=10.5, leading=13, textColor=TINTE,
            spaceBefore=4 * mm, spaceAfter=1 * mm,
        ),
        "body": ParagraphStyle(
            "body", parent=basis["Normal"], fontName="Helvetica",
            fontSize=9.8, leading=13.6, textColor=TINTE, spaceAfter=2 * mm,
        ),
        "klein": ParagraphStyle(
            "klein", parent=basis["Normal"], fontName="Helvetica-Oblique",
            fontSize=9, leading=12, textColor=GRAU,
        ),
        "zelle": ParagraphStyle(
            "zelle", parent=basis["Normal"], fontName="Helvetica",
            fontSize=9.2, leading=12.2, textColor=TINTE,
        ),
        "zellefett": ParagraphStyle(
            "zellefett", parent=basis["Normal"], fontName="Helvetica-Bold",
            fontSize=9.2, leading=12.2, textColor=TINTE,
        ),
        "hinweis": ParagraphStyle(
            "hinweis", parent=basis["Normal"], fontName="Helvetica",
            fontSize=9.4, leading=13, textColor=TINTE,
        ),
    }


def kopfzeile(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(TINTE)
    canvas.rect(0, A4[1] - 12 * mm, A4[0], 12 * mm, stroke=0, fill=1)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 8.5)
    canvas.drawString(22 * mm, A4[1] - 8 * mm, "Steinwerk")
    canvas.setFont("Helvetica", 8.5)
    canvas.drawRightString(
        A4[0] - 22 * mm, A4[1] - 8 * mm,
        "Positionserklärung zur Website mit Anfragesystem",
    )

    canvas.setStrokeColor(LINIE)
    canvas.setLineWidth(0.5)
    canvas.line(22 * mm, 14 * mm, A4[0] - 22 * mm, 14 * mm)
    canvas.setFillColor(GRAU)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(22 * mm, 10 * mm, "Musterdokument ohne Zahlenberechtigung")
    canvas.drawRightString(A4[0] - 22 * mm, 10 * mm, f"Seite {doc.page}")
    canvas.restoreState()


def posTitel(nummer, titel, stunden, preis, s):
    kopf = ParagraphStyle(
        "poskopf", fontName="Helvetica-Bold", fontSize=10.5, leading=13.5,
        textColor=TINTE,
    )
    links = Paragraph(f"{nummer} · {titel}", kopf)
    rechts = Paragraph(f"{stunden} Std. · {preis}", kopf)
    tabelle = Table(
        [[links, rechts]],
        colWidths=[BREITTE_INHALT * 0.66, BREITTE_INHALT * 0.34],
    )
    tabelle.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("LINEBELOW", (0, 0), (-1, 0), 1.1, AKZENT),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
        ("TOPPADDING", (0, 0), (-1, 0), 0),
    ]))
    return tabelle


def tabelle(zeilen, breiten, s, ausrichtung=None):
    t = Table(zeilen, colWidths=breiten, repeatRows=1)
    stil = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, 0), 0.9, TINTE),
        ("LINEBELOW", (0, 1), (-1, -2), 0.4, LINIE),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]
    if ausrichtung:
        for spalte, ausrichtung_je_zeile in ausrichtung.items():
            stil.append(("ALIGN", (spalte, 0), (spalte, -1), ausrichtung_je_zeile))
    t.setStyle(TableStyle(stil))
    return t


def hinweisbox(text, s):
    t = Table([[Paragraph(text, s["hinweis"])]], colWidths=[BREITTE_INHALT])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HINTERGRUND),
        ("LINEBEFORE", (0, 0), (0, -1), 2.4, AKZENT),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return t


def dokument():
    s = stile()
    rahmen = Frame(
        SEITENRAND, 18 * mm, BREITTE_INHALT, A4[1] - 34 * mm,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
        id="inhalt",
    )
    vorlage = BaseDocTemplate(
        "POSITIONEN-ERKLAERUNG.pdf", pagesize=A4,
        title="Positionserklärung — Website mit Anfragesystem",
        author="Steinwerk",
        subject="Erläuterung der einzelnen Rechnungspositionen",
    )
    vorlage.addPageTemplates([
        PageTemplate(id="standard", frames=[rahmen], onPage=kopfzeile)
    ])

    b = []

    b.append(Paragraph("Positionserklärung", s["titel"]))
    b.append(Paragraph(
        "Erläuterung zu jedem Posten der Rechnung "
        "„Website mit Anfragesystem“",
        s["untertitel"],
    ))

    b.append(Paragraph("Warum diese Erläuterung", s["h2"]))
    b.append(Paragraph(
        "Der häufigste Einwand zu einem Angebot dieser Größe lautet: "
        "<b>„eine Website bekomme ich für achthundert Euro.“</b> "
        "Das stimmt – und genau deshalb ist der Vergleich unfair. "
        "Die achtachthundert Euro-Variante zeigt Adresse und Telefonnummer. "
        "Diese Rechnung baut eine Seite, die dem Betrieb sagt, "
        "<b>ob jemand geschrieben hat.</b> Die folgenden Abschnitte machen "
        "sichtbar, welche Stunden in welchem Teil stecken und was passiert, "
        "wenn man genau dort spart.",
        s["body"],
    ))

    b.append(Paragraph("Der Überblick", s["h2"]))
    b.append(tabelle([
        ["Pos.", "Leistung", "Stunden", "Betrag"],
        ["1", "Beratung, Konzeption, Zielgruppe", "3", "225,00 €"],
        ["2", "Design und Seitengestaltung", "10", "750,00 €"],
        ["3", "Technische Umsetzung, 5 Seiten", "12", "900,00 €"],
        ["4", "Kontaktformular mit Anfragen-Protokoll", "9", "675,00 €"],
        ["5", "Anmeldung und Adminbereich absichern", "5", "375,00 €"],
        ["6", "Mailversand, Domain, Sicherheit", "3", "225,00 €"],
        ["7", "Rechtstexte nach Muster", "2", "150,00 €"],
        ["8", "Test, Abnahme, Übergabedokumentation", "4", "300,00 €"],
        ["9", "Einweisung des Betriebs", "2", "150,00 €"],
        [Paragraph("<b>Summe netto</b>", s["zellefett"]),
         Paragraph("<b>50 Stunden</b>", s["zellefett"]),
         Paragraph("<b>3.750,00 €</b>", s["zellefett"])],
        ["10", "Domain .de, erstes Jahr", "", "7,00 €"],
        ["11", "Rechtstexte juristisch prüfen", "", "118,00 €"],
        ["12", "Hosting und Datenbank, erstes Jahr", "", "0,00 €"],
        [Paragraph("<b>Gesamtbetrag</b>", s["zellefett"]), "",
         Paragraph("<b>3.875,00 €</b>", s["zellefett"])],
    ], [12 * mm, 92 * mm, 22 * mm, BREITTE_INHALT - 126 * mm], s,
        ausrichtung={2: "RIGHT", 3: "RIGHT"}))

    b.append(Spacer(1, 4 * mm))
    b.append(hinweisbox(
        "<b>Wo das Geld hingeht.</b> Von 3.750 € Arbeitsleistung stecken "
        "nur 1.650 € im sichtbaren Design. Der Rest ist Formular, Datenbank, "
        "Mailzustellung und Sicherheit – also genau die Teile, die einen "
        "Kunden dazu bringen, tatsächlich zu schreiben statt nur zu gucken.",
        s,
    ))

    b.append(PageBreak())

    positionen = [
        ("1", "Beratung, Konzeption, Zielgruppe", "3 Std. · 225,00 €", [
            "<b>Drin:</b> Gespräch über Zielgruppe, Leistungsspektrum und "
            "Wettbewerb. Daraus entstehen die Seitenstruktur, die Entscheidung "
            "welche Unterseiten es gibt, und die Klärung, wie Anfragen laufen "
            "sollen.",
            "<b>Warum das zuerst kommt:</b> Ohne diesen Schritt baust du die "
            "falsche Website. Der häufigste Grund für gescheiterte "
            "Website-Projekte ist nicht Technik, sondern dass vorher nicht "
            "geklärt wurde, wer die Seite anschauen soll. Ein Fliesenbetrieb "
            "und eine IT-Agentur brauchen völlig andere Seiten.",
            "<b>Wenn man das streicht:</b> Der Kunde bekommt eine Seite, die "
            "ihm nicht geholfen hat, und merkt das erst nach der Schlussrechnung.",
        ]),
        ("2", "Design und Seitengestaltung", "10 Std. · 750,00 €", [
            "<b>Drin:</b> Farbwelt, Schrift, Bildsprache, Layout der "
            "Startseite, Unterseiten, Formularoptik, Darstellung auf Handy und "
            "Desktop.",
            "<b>Konkret an diesem Projekt:</b> Das Fliesenmuster auf der "
            "Startseite ist reines CSS, keine Bilddatei. Grund: eine Website "
            "aus einem Ordner soll ohne Cloudflare überall gleich aussehen, "
            "und Bilder wären bei jeder Kleinigkeit ein neuer Fehler.",
            "<b>Wenn man das streicht:</b> Die Seite funktioniert und ist "
            "hässlich. Bei einer Badsanierung ist das ein Widerspruch, den der "
            "Betrieb täglich erklären müsste.",
        ]),
        ("3", "Technische Umsetzung, 5 Seiten", "12 Std. · 900,00 €", [
            "<b>Drin:</b> HTML, CSS und JavaScript, Aufbau der Seiten, "
            "Navigation, responsive Darstellung.",
            "<b>Als Größenordnung:</b> Für diese Seite sind rund 2.000 Zeilen "
            "Code entstanden. Die wenigste Zeit geht für Effekte drauf, die "
            "meiste für das Zusammenspiel von Navigation, Formular und "
            "Meldungen.",
            "<b>Wenn man das streicht:</b> Es gibt keine Website. Das ist der "
            "einzige Posten ohne Alternative.",
        ]),
        ("4", "Kontaktformular mit Anfragen-Protokoll", "9 Std. · 675,00 €", [
            "<b>Das ist der Posten, für den die ganze Rechnung steht.</b>",
            "<b>Drin:</b> Eingabeprüfung mit konkreten Fehlermeldungen statt "
            "„Bitte prüfen Sie Ihre Eingaben“. Schutz gegen Spam ohne "
            "Captcha. Protokoll, das jede Anfrage festhält, unabhängig davon, ob "
            "der Mailversand klappt. Versand als E-Mail.",
            "<b>Der entscheidende Punkt:</b> Das Protokoll wird <b>vor</b> dem "
            "Mailversand geschrieben. Fällt der Mailserver aus, ist die Anfrage "
            "trotzdem nicht verloren. Ein Aufbau, bei dem erst gemailt und dann "
            "protokolliert wird, verliert genau dann Anfragen, wenn es am "
            "schlimmsten ist.",
            "<b>Wenn man das streicht:</b> Übrig bleibt eine Visitenkarte im "
            "Internet. Die 675 € sind der Aufpreis für die Fähigkeit, den "
            "eigenen Schluss zu sagen.",
        ]),
        ("5", "Anmeldung und Adminbereich absichern", "5 Std. · 375,00 €", [
            "<b>Drin:</b> Anmeldung mit Passwort, signiertes Sitzungs-Cookie, "
            "Protokollansicht, Abmelden.",
            "<b>Warum das eine eigene Position ist:</b> Fast jede Website mit "
            "Kontaktformular hat einen Bereich, in dem die Anfragen stehen. Ohne "
            "Absicherung liegen die Kontaktdaten deiner Kunden öffentlich im "
            "Netz. Bei einem Auftragswert von 18.000 € ist das kein "
            "theoretisches Risiko.",
            "<b>Der Fehler, den die Position verhindert:</b> In diesem Projekt "
            "sah der erste Schutzplan plausibel aus und griff in der Praxis "
            "nicht – die Datei wurde ungeprüft vom Server ausgeliefert. Das "
            "wäre beim Klicken durch die Oberfläche nie aufgefallen.",
        ]),
        ("6", "Mailversand, Domain, Sicherheit", "3 Std. · 225,00 €", [
            "<b>Drin:</b> Domain einrichten, DNS-Einträge, Versand technisch "
            "zum Laufen bringen, Zertifikat, Sicherheitsheader.",
            "<b>Der Teil, den Kunden nie sehen:</b> Eine Mail im Spam-Ordner "
            "ist eine verlorene Anfrage. Deshalb gehören SPF, DKIM und DMARC "
            "zu diesem Posten und nicht zum optionalen Kleinkram.",
            "<b>Wenn man das streicht:</b> Die Website steht, aber die Mails "
            "kommen nicht an. Fällt beim Kunden erst Wochen später auf.",
        ]),
        ("7", "Rechtstexte nach Muster", "2 Std. · 150,00 €", [
            "<b>Drin:</b> Impressum und Datenschutzerklärung mit den Angaben "
            "des Betriebs vorbereitet.",
            "<b>Wichtige Abgrenzung:</b> Das sind Mustertexte, keine "
            "geprüften. Genau deshalb gibt es Position 11. Wer nur diesen "
            "Posten macht und sich mit „ich habe eine Datenschutzerklärung“ "
            "tröstet, riskiert eine Abmahnung, die ein Handwerksbetrieb nicht "
            "verkraftet.",
        ]),
        ("8", "Test, Abnahme, Übergabedokumentation", "4 Std. · 300,00 €", [
            "<b>Drin:</b> Alle Eingabefälle durchtesten, nicht nur den "
            "glücklichen. Ungültige Daten, Spamversuch, falsches Passwort, "
            "abgelaufene Anmeldung, Mailversand in Echtzeit.",
            "<b>Warum ich diesen Posten nie streiche:</b> Beim Bau dieser "
            "Seite hat derselbe Test drei echte Fehler aufgedeckt. Der Schutz "
            "des Adminbereichs saß an der falschen Stelle. Eine Anfrage zeigte "
            "statt der Mailadresse den Versandstatus. Und beim Live-Test fehlte "
            "eine Einstellung, wodurch die Seite gesund wirkte, aber keine Mails "
            "verschickte.",
            "<b>Alle drei wären beim Klicken durch die Oberfläche nie "
            "aufgefallen.</b> Sie wären Wochen später aufgefallen, wenn sich ein "
            "Kunde beschwert hätte.",
        ]),
        ("9", "Einweisung des Betriebs", "2 Std. · 150,00 €", [
            "<b>Drin:</b> Zeigen, wo die Anfragen ankommen, wie man sie liest, "
            "wie man eine Testanfrage stellt, was bei einer Änderung zu "
            "beachten ist.",
            "<b>Wenn man das streicht:</b> Der Betrieb nutzt das Formular "
            "nicht, weil er nicht weiß, ob es funktioniert. Eine gute "
            "Ausstattung, die niemand benutzt, ist eine teure Ausstattung.",
        ]),
    ]

    b.append(Paragraph("Die Positionen im Einzelnen", s["h2"]))

    for nummer, titel, summe, absaetze in positionen:
        block = [posTitel(nummer, titel, summe.split(" · ")[0], summe.split(" · ")[1], s)]
        for a in absaetze:
            block.append(Paragraph(a, s["body"]))
        block.append(Spacer(1, 2.5 * mm))
        b.append(KeepTogether(block))

    b.append(PageBreak())

    b.append(Paragraph("Die drei Fremdkosten", s["h2"]))

    fremd = [
        ("10 · Domain, 7,00 €",
         "Kosten für das erste Jahr, danach jährlich. Den Preis legt der "
         "Registrar fest, nicht ich."),
        ("11 · Rechtstexte prüfen, 118,00 €",
         "Eine Weiterleitung an Anwalt oder Rechtsschutz, keine Rechtsberatung "
         "durch mich. Bei zwei Handwerksbetrieben hat die erste der beiden "
         "Varianten oft schon genug Geld gekostet."),
        ("12 · Hosting, 0,00 €",
         "Bewusst null, damit sichtbar wird, dass laufende Kosten auf den "
         "Kunden zufallen. Das ist kein Verzicht, sondern der Grund, warum das "
         "Angebot insgesamt so niedrig liegt."),
    ]
    for titel, text in fremd:
        b.append(KeepTogether([
            Paragraph(f"<b>{titel}</b>", s["h3"]),
            Paragraph(text, s["body"]),
            Spacer(1, 1.5 * mm),
        ]))

    b.append(Paragraph("Wo kürzen geht, wenn der Preis zieht", s["h2"]))
    b.append(Paragraph(
        "Falls ein Kunde auf 2.500 € will, sind das die Positionen, die den "
        "Schmerz am wenigsten verursachen: Rechtstexte prüfen und Einweisung "
        "zusammen etwa 270 €, danach etwas beim Design verschieben.",
        s["body"],
    ))
    b.append(Paragraph(
        "Was <b>nicht</b> wegdarf: Position 3, 4 und 6. Ohne Position 4 ist es "
        "eine Visitenkarte. Ohne 6 kommen die Mails nicht an. Ohne 3 gibt es "
        "nichts.",
        s["body"],
    ))

    b.append(Spacer(1, 4 * mm))
    b.append(hinweisbox(
        "<b>Musterdokument.</b> Diese Erläuterung dient der Veranschaulichung "
        "und ist keine Rechnung. Zahlen, Adressen und Daten sind beispielhaft. "
        "Maßgeblich für die Beauftragung sind das Angebot und die Rechnung.",
        s,
    ))

    vorlage.build(b)


if __name__ == "__main__":
    dokument()
    print("POSITIONEN-ERKLAERUNG.pdf erstellt")