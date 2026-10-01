#!/usr/bin/env python3
"""Erzeugt die Excel-Leadliste aus ilshofen-final.json."""

import json
from datetime import date

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

PRUEFDATUM = "01.10.2026"
ZIEL = "ILSHOFEN-BETRIEBE-ONLINE-STATUS.xlsx"

BLUE = "1F4E79"
GREY = "F2F2F2"
ROT = "FFC7CE"
GELB = "FFEB9C"
GRUEN = "C6EFCE"

HEAD = Font(bold=True, color="FFFFFF", size=11)
HEAD_FILL = PatternFill("solid", fgColor=BLUE)
RAHMEN = Border(*[Side(style="thin", color="BFBFBF")] * 4)

# Branche und Lead-Bewertung fuer die Betriebe ohne brauchbaren Webauftritt.
# Werte stammen aus den geprueften Verzeichnisangaben, nicht aus Schaetzungen.
ZUSATZ = {
    "Creative Shop - Bastelgeschäft": ("Bastelbedarf, Einzelhandel", "Lead",
        "Inhaberin Sabine Rössler, Kontakt nur per E-Mail"),
    "Elektroinstallation": ("Elektrohandwerk", "Lead (stark)",
        "Eigene Domain elektro-krist.de vorhanden, liefert aber eine leere Seite"),
    "Fliesen Schöller Meisterbetrieb": ("Fliesenleger", "Lead",
        "Meisterbetrieb, nur Branchenbuch-Einträge"),
    "Friedrich Kamm": ("unbekannt", "Lead (ungeklärt)",
        "Branche und Telefon unbekannt, nur Gmail-Kontakt"),
    "Gloria - Fliesen": ("Fliesenleger", "Lead",
        "Inhaber Alexandr Morari, Kontakt nur per Gmail"),
    "Heidi Kastenholz": ("Privatperson", "kein Lead",
        "Schriftführerin im Gewerbeverein, Sparkasse-Mitarbeiterin – kein Gewerbebetrieb"),
    "Kamm und Schere": ("Friseursalon", "Lead",
        "Inhaberin Martina Zahner, Telefon 07904-7863"),
    "Köhler&Bindewald, Bau GbR": ("Bauunternehmen", "Lead (stark)",
        "Domain kb-bau.de registriert, zeigt nur eine t-online-Bausteinsplatzseite"),
    "LVM Versicherung": ("Versicherungsvermittlung", "Lead (eingeschränkt)",
        "Agentur Theo Ring; einziger Auftritt ist die Agenturseite des Versicherers"),
    "Malergeschäft Seiter": ("Malerbetrieb", "Lead",
        "Thomas Seiter; 11880 nennt zusätzlich Ahornweg 5 Eckartshausen, 07904 7752"),
    "Metzgerei Gehring": ("Metzgerei", "Lead",
        "Inhaber Martin Gehring, Kontakt metzgerei@t-online.de"),
    "Mineralien Winter": ("Mineralienhandel, Malerbetrieb", "Lead",
        "Ingfried Winter, keine E-Mail im Verzeichnis"),
    "Reuss & Seckel GbR": ("Kältetechnik, Wärmepumpen", "Lead",
        "René Reuss, nur E-Mail-Kontakt rs-kaelte@t-online.de"),
    "Salon Özlem": ("Friseursalon", "Lead (ungeklärt)",
        "Verzeichnisse nennen zwei verschiedene Inhabernamen (Kayar Özlem / Özlem Gök)"),
    "Seebach Energiesysteme, Stahlhallen, Bauleistungen": (
        "Energiesysteme, Stahlhallen, Bauleistungen", "Lead",
        "Gerd Seebach, Nebenbetrieb, kein Telefon im Verzeichnis, nur E-Mail"),
    "Stukkateur Hofmann": ("Stuckateur", "Lead",
        "Helmut Hofmann e.K.; nicht mit Hofmann Haus GmbH & Co. KG verwechseln"),
    "TH.Fliesen": ("Fliesenleger", "Lead",
        "Florim Thaqi, Kontakt thfliesen1@hotmail.de; MyHammer-Profil ohne Website"),
    "Vermessungsbüro Zeh": ("Vermessungsbüro", "Lead",
        "Dieter Zeh, öffentlich bestellter Vermessungsingenieur, Kontakt zeh.vermessung@t-online.de"),
    "Liebesgefühle Traurednerin Marina Popa": ("Trauredner-Service", "Lead (ungeklärt)",
        "Einzelunternehmen; Kontaktdaten der Stadtliste vor Nutzung verifizieren"),
    "Zur Katze": ("Vereins-/Privatinitiative", "kein Lead",
        "Kein Telefon, keine Branchenverzeichnisse, kein Webauftritt gefunden"),
    "Dipl.-Ing. freier Architekt": ("Architekturbüro", "Lead",
        "Manfred Löw; nur LinkedIn-Profil vorhanden, keine eigene Domain"),
    "Caravan Gerner": ("Wohnwagen, Camping", "Lead",
        "Domain wohnwagen-schweikert.de wird nicht mehr aufgelöst; Kontakt info@caravan-gerner.de"),
    "EP: Home Media": ("Medien, Elektronik", "Lead",
        "Domain vorhanden, aber geparkt, kein Inhalt"),
    "Eugen Schweikert GmbH & Co. KG i.L.": ("Wohnwagen, Camping", "kein Lead",
        "i. L. = in Liquidation; identische Nummer und Domain wie Caravan Gerner"),
    "HALDRUP GmbH": ("unbekannt", "Lead",
        "Verzeichnis nennt Tippfehler-Domain haldup.net; die Mail-Domain haldrup.net ist geparkt"),
    "Huber GmbH Fahrzeuglackierungen": ("Fahrzeuglackierung", "Lead",
        "Domain huber-lackierungen.de wird nicht mehr aufgelöst"),
    "MAAS Profilzentrum GmbH": ("unbekannt", "Lead (ungeklärt)",
        "Domain löst auf, liefert aber HTTP 503; drei Kontaktadressen im Verzeichnis"),
    "Primeros e.V.": ("Verein", "kein Lead",
        "Verein, keine Gewerbefirma; Domain primeros-crailsheim.de wird nicht mehr aufgelöst"),
    "Ristorante Pizzeria La Sila": ("Gastronomie", "Lead",
        "Domain pizzeria-lasila.de wird nicht mehr aufgelöst"),
    "Spriegel Autohaus": ("Autohaus", "Lead",
        "Domain auto-spriegel.de ist geparkt, kein Inhalt"),
    "PopaPlan Smarthome Constantin Popa": ("Smart Home", "Lead",
        "Domain popaplan.de wird nicht mehr aufgelöst"),
}

SPALTEN = [
    ("Firma", 42), ("Online-Status", 24), ("Website gefunden", 34),
    ("Zustand der Domain", 30), ("Straße", 26), ("PLZ / Ort", 22),
    ("Telefon", 16), ("E-Mail", 32), ("Ansprechpartner", 22),
    ("Branche", 30), ("Eignung als Lead", 18), ("Quelle", 30),
    ("Fundstelle / Prüfhinweis", 52), ("Anmerkung", 72),
]


def stil_sheet(ws, titel, breiten, zeilen, freeze="A4"):
    ws.freeze_panes = freeze
    for i, (_, w) in enumerate(zip(SPALTEN, breiten), start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    for c, (spalte, _) in enumerate(SPALTEN, start=1):
        cell = ws.cell(row=3, column=c, value=spalte)
        cell.font = HEAD
        cell.fill = HEAD_FILL
        cell.alignment = Alignment(vertical="center", wrap_text=True)
        cell.border = RAHMEN
    ws.row_dimensions[3].height = 30
    for r, werte in enumerate(zeilen, start=4):
        for c, wert in enumerate(werte, start=1):
            cell = ws.cell(row=r, column=c, value=wert)
            cell.border = RAHMEN
            cell.alignment = Alignment(vertical="top", wrap_text=(c == len(SPALTEN)))
        if (r - 4) % 2:
            for c in range(1, len(SPALTEN) + 1):
                ws.cell(row=r, column=c).fill = PatternFill("solid", fgColor=GREY)
    ws.auto_filter.ref = f"A3:{get_column_letter(len(SPALTEN))}{3 + len(zeilen)}"
    ws.sheet_properties.tabColor = BLUE
    ws.sheet_view.showGridLines = False


def kopf(ws, titel, zeilen):
    ws["A1"] = titel
    ws["A1"].font = Font(bold=True, size=14, color=BLUE)
    ws["A2"] = (f"Stand: {PRUEFDATUM} | Quelle: Gewerbeverein Ilshofen, Stadt Ilshofen "
                f"({len(zeilen)} Betriebe)")
    ws["A2"].font = Font(size=9, italic=True, color="595959")


def zeile(r, mit_branche=True):
    z = ZUSATZ.get(r["firma"], ("", "", ""))
    branche, eignung, extra = z if z[0] else (r["kategorie"] or "unbekannt",
                                               r["eignung"], r["eignung_bei"])
    if mit_branche and not branche:
        branche = r["kategorie"] or "unbekannt"
    return [
        r["firma"], r["klasse"], r["website"] or "–", r["website_check"] or "–",
        r["strasse"], r["ort"], r["telefon"] or "–", r["email"] or "–",
        r["ansprechpartner"] or "–", branche, eignung, r["quelle"],
        r["geprueft_bei"] or "–",
        "; ".join(x for x in (r["hinweis"], extra, r.get("social", "")) if x) or "–",
    ]


def farbe(ws, spalte, von, bis, regeln):
    for r in range(von, bis + 1):
        wert = str(ws.cell(row=r, column=spalte).value or "")
        for muster, fill in regeln:
            if muster in wert:
                for c in range(1, len(SPALTEN) + 1):
                    ws.cell(row=r, column=c).fill = PatternFill("solid", fgColor=fill)
                break


def main():
    rows = json.load(open("ilshofen-final.json", encoding="utf-8"))
    breiten = [w for _, w in SPALTEN]

    ohne = [r for r in rows if r["klasse"] in ("keine Website", "nur Social Media")]
    defekt = [r for r in rows if r["klasse"] == "Website defekt/nicht erreichbar"]
    aktiv = [r for r in rows if r["klasse"] == "Website aktiv"]

    rang = {"Lead": 0, "Lead (stark)": 1, "Lead (ungeklärt)": 2,
            "Lead (eingeschränkt)": 3, "kein Lead": 4}
    ohne.sort(key=lambda r: (rang.get(ZUSATZ.get(r["firma"], ("", r["eignung"], ""))[1], 9), r["firma"]))
    defekt.sort(key=lambda r: (rang.get(ZUSATZ.get(r["firma"], ("", r["eignung"], ""))[1], 9), r["firma"]))

    wb = Workbook()

    # --- Blatt 1: Leads ohne Webauftritt ---
    ws = wb.active
    ws.title = "1 Leads ohne Webauftritt"
    kopf(ws, "Betriebe in Ilshofen ohne eigenen Webauftritt", ohne)
    stil_sheet(ws, "", breiten, [zeile(r) for r in ohne])
    farbe(ws, 11, 4, 3 + len(ohne),
          [("kein Lead", ROT), ("ungeklärt", GELB), ("Lead (stark)", GRUEN)])

    # --- Blatt 2: Website vorhanden, aber unbrauchbar ---
    ws2 = wb.create_sheet("2 Website defekt")
    kopf(ws2, "Domain vorhanden, aber kein nutzbarer Auftritt", defekt)
    stil_sheet(ws2, "", breiten, [zeile(r) for r in defekt])
    farbe(ws2, 11, 4, 3 + len(defekt), [("kein Lead", ROT)])

    # --- Blatt 3: Alle Betriebe mit aktiver Website ---
    ws3 = wb.create_sheet("3 Website aktiv")
    aktiv.sort(key=lambda r: r["firma"])
    kopf(ws3, "Betriebe in Ilshofen mit funktionierender Website", aktiv)
    stil_sheet(ws3, "", breiten, [zeile(r, False) for r in aktiv])

    # --- Blatt 4: Gesamt ---
    ws4 = wb.create_sheet("4 Alle Betriebe")
    alle = sorted(rows, key=lambda r: (r["firma"]))
    kopf(ws4, f"Gesamterhebung Ilshofen ({len(alle)} Betriebe)", alle)
    stil_sheet(ws4, "", breiten, [zeile(r) for r in alle])
    farbe(ws4, 2, 4, 3 + len(alle),
          [("keine Website", ROT), ("Social", GELB), ("defekt", GELB)])

    # --- Blatt 5: Quellen und Methodik ---
    ws5 = wb.create_sheet("5 Quellen & Methodik")
    ws5.sheet_properties.tabColor = "548235"
    ws5.column_dimensions["A"].width = 30
    ws5.column_dimensions["B"].width = 105
    ws5["A1"] = "Quellen, Methodik und Grenzen"
    ws5["A1"].font = Font(bold=True, size=14, color=BLUE)
    inhalt = [
        ("Erhebungsdatum", PRUEFDATUM),
        ("Quellen", "1) https://gewerbeverein-ilshofen.de/mitgliederverzeichnis/ – 124 Mitglieder, "
                    "davon 113 mit Adresse in der Gemeinde Ilshofen\n"
                    "2) https://www.ilshofen.de/wirtschaft/firmenliste – 43 Einträge, 5 Seiten, "
                    "über Kategorien gegengeprüft\n"
                    "3) Websuche, Direktabruf der Domains, Impressums- und Handelsregisterabgleich "
                    "für alle zunächst ohne Website geführten Betriebe"),
        ("Ablauf", "Roh-HTML beider Verzeichnisse gesichert, strukturiert geparst, nach "
                   "Duplikaten bereinigt und zusammengeführt. Für jeden Betrieb ohne "
                   "Website-Eintrag wurde einzeln geprüft: Websuche nach Name und Telefonnummer, "
                   "Abruf von Domain-Kandidaten, Abgleich mit Impressum und Handelsregister. "
                   "Zusätzlich wurden alle 81 eingetragenen Domains automatisch auf "
                   "Erreichbarkeit getestet."),
        ("Ergebnis", f"{len(rows)} Betriebe in der Gemeinde Ilshofen (PLZ 74532).\n"
                     f"{len(ohne)} ohne Webauftritt, davon {sum(1 for r in ohne if ZUSATZ.get(r['firma'], ('', '', ''))[1] == 'Lead')} klare Leads.\n"
                     f"{len(defekt)} mit Domain, aber geparkt, leer oder nicht aufgelöst.\n"
                     f"{len(aktiv)} mit funktionierender Website."),
        ("Online-Status", "keine Website = keine eigene Domain gefunden und kein Social-Profil\n"
                          "nur Social Media = Facebook/Instagram/LinkedIn, aber keine eigene Domain\n"
                          "Website defekt = Domain existiert, liefert aber keinen Inhalt (geparkt, Platzhalter, 4xx/5xx) oder löst nicht mehr auf\n"
                          "Website aktiv = Domain liefert Inhalt"),
        ("Grundsätze", "Es werden ausschließlich öffentlich veröffentlichte Geschäftsdaten "
                       "verwendet. Nichts wurde ergänzt, geschätzt oder aus fremden Betrieben "
                       "mit gleichem Namen übernommen. Namensfallen sind in der Spalte "
                       "Anmerkung dokumentiert."),
        ("Wichtige Grenze", "Die Liste ist so vollständig wie ihre Quellen. Gewerbeverein und "
                            "Stadtverwaltung führen nicht alle Ilshofener Betriebe. Gewerbebetriebe, "
                            "die in keinem der beiden Verzeichnisse stehen, sind nicht enthalten. "
                            "Eine Gewerbeanmeldung ist kein Online-Auftritt, daher sind nur "
                            "Verzeichnisdaten verarbeitet."),
        ("Namensfallen", "Gefunden und bewusst NICHT als Website gewertet:\n"
                         "• autohaus-roessler.de – anderes Autohaus in Rochlitz\n"
                         "• th-fliesen.de – Thomas Heilemann, Lenningen; fliesen-thaqi.de – Betrieb in Fellbach\n"
                         "• vermessung-zeh.de – Dipl.-Ing. Ulrich Zeh, Ribnitz-Damgarten\n"
                         "• architekt-loew.de – Architekturbüro Löw, Limburg a.d. Lahn\n"
                         "• maler-seiter.de – Betrieb in Pforzheim\n"
                         "• feilgmbh.de – andere Feil GmbH, Gastager\n"
                         "• gloria-fliesen in Künzelsau, Metzgerei Gehring in Rot am See"),
        ("Dateien", "Rohdaten und Skripte liegen in recherche/: gv-raw.html, ilshofen-s1..5.html, "
                    "gewerbeverein.json, stadt-ilshofen.json, ilshofen-merged.json, "
                    "ilshofen-final.json sowie die Skripte parse-gewerbeverein.py, "
                    "parse-stadt-ilshofen.py, merge-quellen.py, aufbereiten.py, build-xlsx.py"),
    ]
    for r, (k, v) in enumerate(inhalt, start=3):
        ws5.cell(row=r, column=1, value=k).font = Font(bold=True)
        ws5.cell(row=r, column=1).alignment = Alignment(vertical="top")
        c = ws5.cell(row=r, column=2, value=v)
        c.alignment = Alignment(vertical="top", wrap_text=True)
        ws5.row_dimensions[r].height = max(30, 14 * (v.count("\n") + 1))
    ws5.sheet_view.showGridLines = False

    wb.save(ZIEL)
    print(f"geschrieben: {ZIEL}")
    print(f"  Blatt 1 Leads ohne Webauftritt: {len(ohne)}")
    print(f"  Blatt 2 Website defekt:          {len(defekt)}")
    print(f"  Blatt 3 Website aktiv:          {len(aktiv)}")
    print(f"  Blatt 4 Alle Betriebe:          {len(alle)}")


if __name__ == "__main__":
    main()