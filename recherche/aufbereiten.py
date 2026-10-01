#!/usr/bin/env python3
"""Vereinheitlicht Quellen + Web-Verifikation und prüft alle Websites auf Erreichbarkeit."""

import json
import re
import socket
import ssl
import unicodedata
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

PRUEFDATUM = "2026-10-01"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

# Zuordnung Prüfergebnis -> Datensatz aus den Quellen (Namen, nicht Indizes:
# die Reihenfolge der Quellen kann sich zwischen Läufen ändern).
VERIFIKATION = {
    "apotheke ilshofen": (1, "website", "https://www.apotheke-ilshofen.de/", "", "hoch",
        "Google, Stadt Ilshofen Ärzte-Seite, Impressum geprüft",
        "Inhaber Henner Vogelmann e.Kfm.; apotheke-ilshofen-app.de als Zweitauftritt"),
    "autohaus rossler": (2, "website", "https://www.auto-roessler.de/", "", "hoch",
        "Google, Impressum bestätigt Matthias Rössler, Ludwigstraße 40, 07904-556",
        "autohaus-roessler.de ist eine ANDERE Firma in Rochlitz – nicht Ilshofen"),
    "autohaus tobies e k kfz rep u handel": (3, "website", "https://www.autohaus-tobies.de/", "", "hoch",
        "Google, Stadt Ilshofen Firmenliste, Impressum Almarstraße 6, 07904-275",
        "Rechtsform inzwischen GmbH & Co. KG"),
    "bestattungen rossler": (4, "website", "https://www.roessler-bestattungen.de/", "", "hoch",
        "E-Mail-Domain aus Gewerbeverein, Seite abgerufen: Eckartshäuser Str. 26, 07904 228",
        "Neuer Auftritt, in Stadtliste noch nicht verlinkt"),
    "creative shop bastelgeschaft": (5, "keine_website", "", "", "mittel",
        "Nur Gewerbeverein + Branchenbuch; 4 Domain-Kandidaten ohne DNS",
        "Sabine Rössler, Inhaberin. sabineroessler.com ist eine andere Person (München)"),
    "dipl ing freier architekt": (6, "nur_social", "", "https://www.linkedin.com/in/manfred-loew-13b69612b", "mittel",
        "Google, heinze.de, firmenabc.com, LinkedIn",
        "architekt-loew.de ist ein anderes Büro in Limburg a.d. Lahn"),
    "elektroinstallation": (7, "keine_website", "", "", "mittel",
        "Gewerbeverein, Das Örtliche, elektriker-Portal",
        "elektro-krist.de ist seine Mail-Domain, liefert aber 0 Bytes (leer, last-modified 2016). Jürgen Krist"),
    "esso tankstelle": (8, "website", "https://tankstelle-ilshofen.de/", "", "hoch",
        "Domainabruf, Kontaktblock bestätigt Suat Altuntas, Crailsheimer Str. 32, 07904 237",
        "EG-Group-Partnerbetrieb"),
    "feil gmbh zimmerei": (9, "website", "https://www.feil-holzbau.de/", "", "hoch",
        "Domainabruf, Impressum: Holzbau Feil GmbH, Kilianstraße 28, 07904 332, HRB 570912",
        "feilgmbh.de ist eine andere Feil GmbH (Gastager)"),
    "flaschnerei sanitaranlagen": (10, "website", "https://www.hofmann-flaschnerei.de/", "", "hoch",
        "Google, Seite abgerufen: Flaschnerei Hofmann, Ludwigstraße 34, 07904 320",
        "Familienbetrieb seit 1969; Stadtliste führt ihn noch ohne Link"),
    "flaschnerei jurgen hofmann": (10, "website", "https://www.hofmann-flaschnerei.de/", "", "hoch",
        "Google, Seite abgerufen: Flaschnerei Hofmann, Ludwigstraße 34, 07904 320",
        "Doppelt erfasst: Stadt Ilshofen führt denselben Betrieb unter dieser Bezeichnung"),
    "fliesen scholler meisterbetrieb": (11, "keine_website", "", "", "mittel",
        "Gewerbeverein, fliesenleger.net, 11880; 3 Domain-Kandidaten ohne DNS",
        "Nur Branchenbuch-Einträge"),
    "friedrich kamm": (12, "keine_website", "", "", "niedrig",
        "Nur Gewerbeverein; kein Telefon, kein Branchenverzeichniseintrag",
        "Weder Telefon noch Branche bekannt. Branche vor Kontaktaufnahme klären"),
    "gartnerei floristik brunner": (13, "website", "http://pflanzen-brunner.de", "", "hoch",
        "Domainabruf, Impressum Crailsheimer Str. 30, 07904 286", ""),
    "gloria fliesen": (14, "keine_website", "", "", "mittel",
        "Nur Gewerbeverein; 6 Domain-Kandidaten ohne Inhalt",
        "Inhaber Alexandr Morari, Kontakt nur per Gmail. 'Gloria Fliesen' in Künzelsau ist ein anderer Betrieb"),
    "heidi kastenholz": (15, "keine_website", "", "", "hoch",
        "Gewerbeverein-Vorstandsseite, Sparkasse Ilshofen",
        "KEINE Gewerbefirma, sondern Privatperson (Schriftführerin im Gewerbeverein, Sparkasse-Mitarbeiterin). "
        "Als Lead NICHT qualifizieren"),
    "hws hausgeratetechnik": (16, "website", "https://www.tp-hws-hausgeraetetechnik.de", "", "hoch",
        "Domainabruf, Kontakt/Service/Über uns: Ludwigstraße 36, 07904 974016",
        "Portalseite der telering-Kooperation 'Technik-Profi', kein frei entwickelter Auftritt"),
    "ilshofener kebaphaus": (17, "website", "https://ilshofener-kebaphaus.de", "", "hoch",
        "Domainabruf mit Impressum Hallerstr. 6, 07904 944321",
        "PLZ im Impressum fehlerhaft (82211). Facebook-Seite im Footer, URL nicht ermittelt"),
    "kamm und schere": (18, "keine_website", "", "", "mittel",
        "planity.com, klussmann-friseure.de, Gewerbeverein 07904-7863",
        "Friseursalon, Inhaberin Martina Zahner. Alle gleichnamigen Treffer sind andere Betriebe"),
    "kohler&bindewald bau gbr": (19, "keine_website", "", "", "hoch",
        "Verzeichnisse nennen kb-bau.de; Abruf liefert t-online-Bausteinsplatzseite ohne Firmendaten",
        "Domain registriert, Inhalt leer. 'Bindewald Bau e.K.' (Eckartshäuser Str. 42) ist ein eigener Betrieb"),
    "lvm versicherung": (20, "keine_website", "", "", "hoch",
        "agentur.lvm.de/ring (Agentur Theo Ring, Steinbrunnenstr. 4, 07904 8178)",
        "Einziger Webauftritt ist die vom Versicherer betriebene Agenturseite auf lvm.de"),
    "malergeschaft seiter": (21, "keine_website", "", "", "mittel",
        "maler.org, malerfinder.de, Branchenbuch, firmenabc.com, Gewerbeverein",
        "Thomas Seiter. maler-seiter.de ist ein fremder Betrieb in Pforzheim. 11880 nennt zusätzlich "
        "Ahornweg 5 Eckartshausen, 07904 7752 – ggf. derselbe Betrieb mit abweichender Adresse"),
    "metzgerei gehring": (22, "keine_website", "", "", "hoch",
        "Gaststättenverzeichnis Stadt, metzgereien.net, speisekarte.menu, Gewerbeverein",
        "Martin Gehring. 'Metzgerei Martin Gehring' in Rot am See ist ein verwandtes, anderes Unternehmen"),
    "mineralien winter": (23, "keine_website", "", "", "mittel",
        "Das Örtliche, Gelbe Seiten, 11880, Branchenbuch, Gewerbeverein",
        "Ingfried Winter, Mineralienhandel + Malerbetrieb. Keine E-Mail im Verzeichniseintrag"),
    "praxis fur therapie und pravention": (24, "website", "https://www.hh-therapie-praevention.de", "", "hoch",
        "Domainabruf mit Leistungen/Kurse/Preise; Praxis Heide Haas, Kirchstr. 7",
        "Telefon auf der Website 07904-9448884 weicht vom Verzeichnis (07904-7744) ab – Nummer verifizieren"),
    "reuss seckel gbr": (25, "keine_website", "", "", "hoch",
        "Gewerbeverein, Das Örtliche, 11880, Stadtbranchenbuch; 7 Domain-Kandidaten ohne Reaktion",
        "Kältetechnik/Wärmepumpen, René Reuss, rs-kaelte@t-online.de. Nur E-Mail-Kontakt"),
    "salon ozlem": (26, "keine_website", "", "", "mittel",
        "Gewerbeverein, Das Örtliche (Özlem Gök), friseur.org, planity.mom",
        "Inhabername in Verzeichnissen uneinheitlich (Kayar Özlem vs. Özlem Gök) – ggf. zwei Einträge "
        "für denselben Salon"),
    "seebach energiesysteme stahlhallen bauleistungen": (27, "keine_website", "", "", "hoch",
        "Nur Gewerbeverein; sonst keine Branchenbuch-/Social-Einträge",
        "Gerd Seebach, gerd-seebach@t-online.de. Kein Telefon im Eintrag, Nebenbetrieb ohne Website"),
    "steinmetz friedemann strasser": (28, "website", "http://friedemannstrasser.de", "", "hoch",
        "Direktabruf; Gewerbeverein nennt dieselbe E-Mail-Domain info@friedemannstrasser.de",
        "ACHTUNG: Website nennt Betriebsadresse Satteldorfer Hauptstr. 51, 74589 Satteldorf, 07951/9610-49. "
        "Der Ilshofer Eintrag Bahnhofstr. 35 wirkt wie Werkstatt/Filiale ohne eigenen Auftritt. Nur http"),
    "stukkateur hofmann": (29, "keine_website", "", "", "mittel",
        "Gewerbeverein, Yelp; 4 Domain-Kandidaten nicht erreichbar",
        "Helmut Hofmann e.K. Nicht verwechseln mit der Hofmann Haus GmbH & Co. KG (Immobilien, HRA 725375)"),
    "th fliesen": (30, "keine_website", "", "", "mittel",
        "Gewerbeverein, MyHammer-Profil ohne Website",
        "Florim Thaqi. NAMENSFALLE: th-fliesen.de ist Thomas Heilemann (Lenningen), fliesen-thaqi.de "
        "ist ein Fellbacher Betrieb – beide zählen nicht"),
    "vermessungsburo zeh": (31, "keine_website", "", "", "hoch",
        "Gewerbeverein; weitere Domain-Kandidaten nicht erreichbar",
        "Dieter Zeh. vermessung-zeh.de gehört Dipl.-Ing. Ulrich Zeh in Ribnitz-Damgarten – anderer Betrieb"),
    "zentrum mensch": (32, "website", "https://www.im-zm.de", "", "hoch",
        "Abruf im-zm.de/impressum; HRB 770848",
        "Zentrum Mensch gGmbH, Gesundheits-/Therapiezentrum (Physio/Ergo/Logopädie), Standorte Ilshofen, "
        "Satteldorf, Crailsheim, Schwäbisch Hall. Ludwigstr. 36 ist nur Gebäudegemeinschaft mit HWS"),
    "zur katze": (33, "keine_website", "", "", "niedrig",
        "Nur Gewerbeverein; Websuche nach Name und Ort ohne Treffer",
        "KEINE Gewerbefirma: Eintrag ohne Telefon, E-Mail kscharkowski@web.de, kein Branchenverzeichnis. "
        "Vermutlich Tierschutz-/Privatinitiative. Als Lead NICHT qualifizieren"),
    "hohenloher bauerngenossenschaft die backerei in bauernhand": (34, "website",
        "https://www.hohenloherbauerngenossenschaft.de/standorte", "", "hoch",
        "Abruf /standorte bestätigt Ilshofen, Eckartshäuser Str. 57, 07904/94 29 082",
        "Filiale der Hohenloher Bauerngenossenschaft (Backstube Schrozberg), Teil der LBV Raiffeisen eG "
        "Schrozberg. Gruppendomain. lbv.de ist der LandesBauernVerband Bayern, nicht dieselbe Organisation"),
    "lbv frischemarkt": (35, "website", "https://lbv-schrozberg.de/", "", "hoch",
        "lbv-schrozberg.de/ansprechpartner, EDEKA-Marktseite, Stadt Ilshofen Firmenliste",
        "Markt der LBV Raiffeisen eG Schrozberg (EDEKA LBV). Abgedeckt über Konzernwebsite, keine eigene "
        "Standortseite, kein eigenes Social-Profil"),
    "liebesgefuhle traurednerin marina popa": (36, "keine_website", "", "", "mittel",
        "Nur städtische Firmenliste; keine weiteren Treffer",
        "Traurednerin, Einzelunternehmen. Datenqualität Stadtliste unsicher – Adresse und Telefon vor Nutzung "
        "verifizieren"),
    "rsy green gmbh": (37, "website", "https://blumengalerie-sauermann.de", "", "hoch",
        "Abruf /impressum: RSY Green GmbH, Justus-von-Liebig-Str. 3, 74532 Ilshofen, HRB 784920",
        "Die vom Gewerbeverein verlinkte Domain gehört tatsächlich der RSY Green GmbH. Zweite Domain "
        "rsygreen.de (passwortgeschützt). Ladengeschäft Blumengalerie in Waldenburger Str. 29, Gaisbach"),
}

# Manuelle Eignungsbewertung der Leads (firma -> (Eignung, Begruendung))
EIGNUNG = {
    "heidi kastenholz": ("kein Lead", "Privatperson, kein Gewerbebetrieb"),
    "zur katze": ("kein Lead", "Vereins-/Privatinitiative, kein Gewerbebetrieb"),
    "friedrich kamm": ("Lead (ungeklärt)", "Branche und Telefon unbekannt, nur Gmail-Kontakt"),
    "liebesgefuhle traurednerin marina popa": ("Lead (ungeklärt)",
        "Einzelunternehmen, Kontaktdaten aus Stadtliste vor Nutzung verifizieren"),
    "salon ozlem": ("Lead (ungeklärt)", "Zwei abweichende Inhabernamen in Verzeichnissen"),
    "lvm versicherung": ("Lead (eingeschränkt)",
        "Agentur eines Versicherers; Neukundenvermittlung oft vertraglich gebunden"),
    "elektroinstallation": ("Lead (stark)", "Eigene Domain vorhanden, liefert aber eine leere Seite"),
    "kohlerbindewald bau gbr": ("Lead (stark)", "Eigene Domain registriert, nur Platzhalterseite"),
}

STOPPWORTE = {"gmbh", "gbr", "ag", "kg", "ohg", "mbh", "co", "ug", "ev", "e", "v", "k", "u", "kfm", "ing", "und", "der", "die", "das", "fur", "i"}


def norm(s):
    s = (s or "").lower().replace("ß", "ss")
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def vkey(firma):
    return " ".join(w for w in norm(firma).split() if w not in STOPPWORTE)


def http_check(url):
    if not url:
        return ""
    host = re.sub(r"^https?://", "", url).split("/")[0]
    for candidate in ((url,) if "//" in url else ("https://" + url, "http://" + url)):
        try:
            req = urllib.request.Request(candidate, headers={"User-Agent": UA}, method="GET")
            with urllib.request.urlopen(req, timeout=15, context=CTX) as r:
                body, code = r.read(4000), r.status
            if len(body.strip()) < 200:
                return f"leer/Platzhalter (HTTP {code}, {len(body)} Bytes)"
            return f"ok (HTTP {code})"
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                return f"gesperrt (HTTP {e.code})"
            if e.code == 404:
                continue
            return f"HTTP {e.code}"
        except Exception:
            continue
    # Kein Inhalt: unterscheiden, ob die Domain ueberhaupt aufgeloest wird
    try:
        socket.getaddrinfo(host, None)
        return "geparkt (DNS vorhanden, kein Inhalt)"
    except OSError:
        return "Domain nicht aufgeloest"


def norm_url(u):
    u = (u or "").strip().rstrip("/")
    return re.sub(r"^https?://", "", u)


def main():
    merged = json.load(open("ilshofen-merged.json", encoding="utf-8"))
    offen = [r for r in merged if not r["website"]]
    verif_by_key = {vkey(k): v for k, v in VERIFIKATION.items()}
    eign_by_key = {vkey(k): v for k, v in EIGNUNG.items()}

    # Dublette: Stadt fuehrt denselben Betrieb als "Flaschnerei Jürgen Hofmann"
    # (gleiche Adresse Ludwigstraße 34, gleiche Nummer) wie der GV-Eintrag
    # "Flaschnerei/Sanitäranlagen". Einen Datensatz behalten, Herkunft vermerken.
    doppelte = [r for r in merged if norm(r["firma"]).startswith("flaschnerei j")]
    ziel = next((r for r in merged if r["firma"] == "Flaschnerei/Sanitäranlagen"), None)
    if doppelte and ziel:
        ziel["quelle"] += " + Stadt Ilshofen"
        ziel["hinweis_dublette"] = (
            "Doppelt erfasst: Stadt Ilshofen führt denselben Betrieb als "
            "'Flaschnerei Jürgen Hofmann' (gleiche Adresse Ludwigstraße 34, gleiche Nummer)."
        )
        merged = [r for r in merged if r not in doppelte]

    zugeordnet = set()
    rows = []
    for r in merged:
        o = dict(r)
        k = vkey(o["firma"])
        o["website"] = norm_url(o["website"])
        o.setdefault("ansprechpartner", "")
        o.setdefault("kategorie", "")
        o.setdefault("email", "")
        o["social"] = ""
        o["sicherheit"] = ""
        o["geprueft_bei"] = ""
        o["hinweis"] = ""
        o["pruefdatum"] = PRUEFDATUM
        o["eignung"] = ""
        o["eignung_bei"] = ""

        v = verif_by_key.get(k)
        if v:
            nr, status, web, social, sich, befund, hinweis = v
            o["status"] = status
            o["website"] = norm_url(web)
            o["social"] = social
            o["sicherheit"] = sich
            o["geprueft_bei"] = befund
            o["hinweis"] = hinweis
            zugeordnet.add(k)
        elif not o["website"]:
            raise SystemExit(f"FEHLT: keine Verifikation fuer '{o['firma']}'")
        else:
            o["status"] = "website"
            o["geprueft_bei"] = "Quellenverzeichnis"
            o["sicherheit"] = "unbestätigt"

        if k in eign_by_key:
            o["eignung"], o["eignung_bei"] = eign_by_key[k]
        else:
            o["eignung"] = "Lead"
        rows.append(o)

    # --- Erreichbarkeit aller Websites ---
    urls = sorted({r["website"] for r in rows if r["website"]})
    print(f"Verifiziert: {len(zugeordnet)} Datensätze")
    print(f"Erreichbarkeit prüfen: {len(urls)} Domains ...")
    with ThreadPoolExecutor(max_workers=12) as pool:
        checks = dict(zip(urls, pool.map(http_check, urls)))
    for r in rows:
        r["website_check"] = checks.get(r["website"], "") if r["website"] else ""

    def klasse(r):
        c, w = r["website_check"], r["website"]
        if r["status"] == "keine_website":
            return "keine Website"
        if r["status"] == "nur_social":
            return "nur Social Media"
        if not w or c.startswith(("nicht erreichbar", "geparkt", "Domain nicht", "HTTP 4", "HTTP 5", "leer")):
            return "Website defekt/nicht erreichbar"
        return "Website aktiv"

    for r in rows:
        r["klasse"] = klasse(r)

    json.dump(rows, open("ilshofen-final.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    print(f"\nBetriebe gesamt: {len(rows)}")
    for k in ("Website aktiv", "Website defekt/nicht erreichbar", "keine Website", "nur Social Media"):
        n = sum(1 for r in rows if r["klasse"] == k)
        if n:
            print(f"  {k:36} {n}")


if __name__ == "__main__":
    main()