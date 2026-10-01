#!/usr/bin/env python3
"""Kurzfassung der Positionserklärung.

Gegenstück zu build-pdf.py: weniger Positionen, weniger Text, zwei Seiten.
Enthält bewusst nur das, was am Projekt hängenbleibt, wenn ein Kunde den
Umfang reduziert — Formular, Protokoll und Adminbereich bleiben.
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
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

RAND = 22 * mm
BREITE = A4[0] - 2 * RAND

TINTE = colors.HexColor("#17130f")
GRAU = colors.HexColor("#6f655c")
LINIE = colors.HexColor("#ddd5cb")
HINTERGRUND = colors.HexColor("#f6f2ed")
AKZENT = colors.HexColor("#8a7a68")
GRUEN = colors.HexColor("#4a6b52")


def stile():
    b = getSampleStyleSheet()
    return {
        "titel": ParagraphStyle(
            "titel", parent=b["Title"], fontName="Helvetica-Bold",
            fontSize=19, leading=23, textColor=TINTE, alignment=TA_LEFT,
            spaceAfter=1.5 * mm,
        ),
        "untertitel": ParagraphStyle(
            "untertitel", parent=b["Normal"], fontName="Helvetica",
            fontSize=10, leading=13, textColor=GRAU, spaceAfter=5 * mm,
        ),
        "h2": ParagraphStyle(
            "h2", parent=b["Heading2"], fontName="Helvetica-Bold",
            fontSize=11.5, leading=14, textColor=TINTE,
            spaceBefore=5 * mm, spaceAfter=1.5 * mm,
        ),
        "body": ParagraphStyle(
            "body", parent=b["Normal"], fontName="Helvetica",
            fontSize=9.6, leading=13.2, textColor=TINTE, spaceAfter=1.8 * mm,
        ),
        "z": ParagraphStyle(
            "z", parent=b["Normal"], fontName="Helvetica",
            fontSize=8.9, leading=11.6, textColor=TINTE,
        ),
        "zf": ParagraphStyle(
            "zf", parent=b["Normal"], fontName="Helvetica-Bold",
            fontSize=8.9, leading=11.6, textColor=TINTE,
        ),
        "zg": ParagraphStyle(
            "zg", parent=b["Normal"], fontName="Helvetica-Bold",
            fontSize=8.9, leading=11.6, textColor=GRUEN,
        ),
    }


def kopf(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(TINTE)
    canvas.rect(0, A4[1] - 12 * mm, A4[0], 12 * mm, stroke=0, fill=1)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 8.5)
    canvas.drawString(RAND, A4[1] - 8 * mm, "Steinwerk")
    canvas.setFont("Helvetica", 8.5)
    canvas.drawRightString(
        A4[0] - RAND, A4[1] - 8 * mm,
        "Website mit Anfragesystem — Kurzfassung",
    )
    canvas.setStrokeColor(LINIE)
    canvas.setLineWidth(0.5)
    canvas.line(RAND, 14 * mm, A4[0] - RAND, 14 * mm)
    canvas.setFillColor(GRAU)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(RAND, 10 * mm, "Musterdokument ohne Zahlenberechtigung")
    canvas.drawRightString(A4[0] - RAND, 10 * mm, f"Seite {doc.page}")
    canvas.restoreState()


def box(text, s, streifen=AKZENT):
    t = Table([[Paragraph(text, s["body"])]], colWidths=[BREITE])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HINTERGRUND),
        ("LINEBEFORE", (0, 0), (0, -1), 2.4, streifen),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return t


POSITIONEN = [
    ("1", "Konzeption und Design", "Farbwelt, Layout, Startseite, Mobilansicht", "8", "600,00 €"),
    ("2", "Website aufbauen", "4 Seiten statt 5, Navigation, alle Geräte", "10", "750,00 €"),
    ("3", "Kontaktformular mit Protokoll",
     "Prüfung, Spamschutz, jede Anfrage festgehalten, Mailversand", "9", "675,00 €"),
    ("4", "Adminbereich absichern",
     "Anmeldung mit Passwort, Sitzung, niemand liest mit", "5", "375,00 €"),
    ("5", "Mail, Domain, Sicherheit",
     "Domain, DNS, Zertifikat, Mail kommt auch an", "3", "225,00 €"),
    ("6", "Rechtstexte nach Muster", "Impressum und Datenschutz vorbereitet", "2", "150,00 €"),
    ("7", "Test und Übergabe", "Alle Fehlerfälle durchtesten, kurze Doku", "3", "225,00 €"),
    ("8", "Einweisung", "Betrieb zeigt, wo die Anfragen ankommen", "2", "150,00 €"),
]

BLEIBT = [
    ("3", "Kontaktformular mit Protokoll", "675,00 €"),
    ("4", "Adminbereich absichern", "375,00 €"),
    ("5", "Mail, Domain, Sicherheit", "225,00 €"),
    ("8", "Einweisung", "150,00 €"),
]

WENIGER = [
    ("Gespräch und Zielgruppe",
     "weniger Planung vorab",
     "Ich arbeite nach Ihren Vorgaben und melde mich bei Unklarheiten."),
    ("Eine Seite weniger",
     "z. B. kein eigener Referenzbereich",
     "Alle Referenzen kommen auf eine gemeinsame Seite."),
    ("Weniger Testzeit",
     "2 statt 4 Stunden",
     "Die wichtigsten Fälle werden geprüft, nicht jede Variante."),
]


def dokument():
    s = stile()
    rahmen = Frame(
        RAND, 18 * mm, BREITE, A4[1] - 34 * mm,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
        id="inhalt",
    )
    vorlage = BaseDocTemplate(
        "POSITIONEN-ERKLAERUNG-KURZ.pdf", pagesize=A4,
        title="Positionserklärung Kurzfassung — Website mit Anfragesystem",
        author="Steinwerk",
        subject="Kurzfassung der Rechnungspositionen",
    )
    vorlage.addPageTemplates([PageTemplate(id="s", frames=[rahmen], onPage=kopf)])

    b = []

    b.append(Paragraph("Positionserklärung, Kurzfassung", s["titel"]))
    b.append(Paragraph(
        "Website mit Anfragesystem — reduzierter Umfang, gleiche Funktion",
        s["untertitel"],
    ))
    b.append(Paragraph(
        "Diese Variante kommt mit weniger Seiten und weniger Planungszeit aus. "
        "Was die Website ausmacht, bleibt vollständig drin: das Formular, das "
        "jede Anfrage festhält, und ein Adminbereich, den niemand mitlesen kann.",
        s["body"],
    ))

    b.append(Paragraph("Die Positionen", s["h2"]))

    zeilen = [[
        Paragraph("<b>Nr.</b>", s["z"]),
        Paragraph("<b>Leistung</b>", s["z"]),
        Paragraph("<b>Was drin ist</b>", s["z"]),
        Paragraph("<b>Std.</b>", s["z"]),
        Paragraph("<b>Betrag</b>", s["z"]),
    ]]
    for nummer, leistung, inhalt, stunden, preis in POSITIONEN:
        zeilen.append([
            Paragraph(nummer, s["z"]),
            Paragraph(f"<b>{leistung}</b>", s["z"]),
            Paragraph(inhalt, s["z"]),
            Paragraph(stunden, s["z"]),
            Paragraph(preis, s["z"]),
        ])
    zeilen.append([
        Paragraph("", s["zf"]), Paragraph("<b>Summe netto</b>", s["zf"]),
        Paragraph("<b>42 Stunden</b>", s["zf"]), Paragraph("<b>3.150,00 €</b>", s["zf"]),
    ])
    zeilen.append([
        Paragraph("", s["z"]), Paragraph("Domain .de, erstes Jahr", s["z"]),
        Paragraph("", s["z"]), Paragraph("7,00 €", s["z"]),
    ])
    zeilen.append([
        Paragraph("", s["z"]), Paragraph("Rechtstexte prüfen lassen", s["z"]),
        Paragraph("", s["z"]), Paragraph("118,00 €", s["z"]),
    ])
    zeilen.append([
        Paragraph("", s["zf"]), Paragraph("<b>Gesamtbetrag</b>", s["zf"]),
        Paragraph("", s["zf"]), Paragraph("<b>3.275,00 €</b>", s["zf"]),
    ])

    t = Table(zeilen, colWidths=[11 * mm, 46 * mm, BREITE - 88 * mm, 12 * mm, 21 * mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (3, 0), (3, -1), "RIGHT"),
        ("ALIGN", (4, 0), (4, -1), "RIGHT"),
        ("LINEBELOW", (0, 0), (-1, 0), 0.9, TINTE),
        ("LINEBELOW", (0, 1), (-1, -2), 0.4, LINIE),
        ("LINEABOVE", (0, -1), (-1, -1), 0.9, TINTE),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    b.append(t)

    b.append(Spacer(1, 4 * mm))
    b.append(box(
        "<b>600 € weniger als die Vollversion</b> — und dieselbe Fähigkeit, "
        "zu sagen, ob jemand geschrieben hat. Das Formular mit Protokoll, der "
        "Adminbereich und der Mailversand sind unverändert enthalten.",
        s,
    ))

    b.append(Paragraph("Was drinbleibt", s["h2"]))
    b.append(Paragraph(
        "Diese vier Positionen sind der Grund für die Rechnung. Sie stehen in "
        "jeder Variante, weil eine Website ohne sie eine Visitenkarte ist.",
        s["body"],
    ))

    z = [[Paragraph("<b>Nr.</b>", s["z"]), Paragraph("<b>Leistung</b>", s["z"]),
          Paragraph("<b>Betrag</b>", s["z"])]]
    for nummer, leistung, preis in BLEIBT:
        z.append([Paragraph(nummer, s["zg"]), Paragraph(leistung, s["z"]),
                  Paragraph(preis, s["z"])])
    t2 = Table(z, colWidths=[14 * mm, BREITE - 35 * mm, 21 * mm])
    t2.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (2, 0), (2, -1), "RIGHT"),
        ("LINEBELOW", (0, 0), (-1, 0), 0.9, TINTE),
        ("LINEBELOW", (0, 1), (-1, -1), 0.4, LINIE),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    b.append(t2)

    abschnitt = [
        Paragraph("Was weniger wird", s["h2"]),
        Paragraph(
            "Diese drei Abstriche sind der Preis für die niedrigere Summe. "
            "Keiner davon betrifft die Funktion.",
            s["body"],
        ),
    ]

    w = [[Paragraph("<b>Abstrich</b>", s["z"]), Paragraph("<b>Bedeutung</b>", s["z"]),
          Paragraph("<b>Was ich stattdessen tue</b>", s["z"])]]
    for a, b_, c in WENIGER:
        w.append([Paragraph(a, s["z"]), Paragraph(b_, s["z"]), Paragraph(c, s["z"])])
    t3 = Table(w, colWidths=[38 * mm, 40 * mm, BREITE - 78 * mm], repeatRows=1)
    t3.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, 0), 0.9, TINTE),
        ("LINEBELOW", (0, 1), (-1, -1), 0.4, LINIE),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    abschnitt.append(t3)
    abschnitt.append(Spacer(1, 3 * mm))
    b.append(KeepTogether(abschnitt))
    b.append(box(
        "<b>Musterdokument.</b> Dient der Veranschaulichung und ist keine "
        "Rechnung. Maßgeblich für die Beauftragung sind das Angebot und die "
        "Rechnung.",
        s,
        streifen=GRAU,
    ))

    vorlage.build(b)


if __name__ == "__main__":
    dokument()
    print("POSITIONEN-ERKLAERUNG-KURZ.pdf erstellt")