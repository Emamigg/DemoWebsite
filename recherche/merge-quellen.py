#!/usr/bin/env python3
"""Führt Gewerbeverein- und Stadtliste zu einem Datensatz zusammen.

Nur Betriebe, deren Adresse in der Gemeinde Ilshofen (PLZ 74532) liegt,
werden übernommen. Andere Orte des Gewerbevereins (Schwäbisch Hall,
Wolpertshausen, Vellberg, ...) werden verworfen.
"""

import json
import re
import unicodedata

GEMEINDE_ILSOFEN = ("74532", "74523 Ilshofen")


def key(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def toks(s):
    return set(key(s).split()) - {
        "gmbh", "gbr", "ag", "kg", "ohg", "mbh", "co", "ug", "ev", "e", "v",
        "und", "der", "die", "das", "firma", "inhaber", "the", "company",
    }


def sim(a, b):
    A, B = toks(a), toks(b)
    if not A or not B:
        return 0.0
    return len(A & B) / len(A | B)


def in_ilshofen(*fields):
    blob = " ".join(f or "" for f in fields)
    return any(g in blob for g in GEMEINDE_ILSOFEN)


def split_adresse(anschrift):
    """'Hauptstr. 12\\n74532 Ilshofen' -> ('Hauptstr. 12', '74532 Ilshofen')"""
    lines = [ln.strip() for ln in (anschrift or "").split("\n") if ln.strip()]
    if not lines:
        return "", ""
    if len(lines) == 1:
        return lines[0], ""
    return " ".join(lines[:-1]), lines[-1]


def main():
    gv = json.load(open("gewerbeverein.json", encoding="utf-8"))
    st = json.load(open("stadt-ilshofen.json", encoding="utf-8"))

    rows = []

    # --- Gewerbeverein ---
    for g in gv:
        if not in_ilshofen(g["plz_ort"], g["anschrift"]):
            continue
        strasse, ort = split_adresse(g["anschrift"])
        rows.append({
            "firma": g["firma"],
            "ansprechpartner": g["ansprechpartner"],
            "strasse": strasse or g["plz_ort"],
            "ort": g["plz_ort"] or ort,
            "telefon": g["telefon"],
            "email": g["email"],
            "website": g["website"],
            "kategorie": "",
            "quelle": "Gewerbeverein Ilshofen",
            "quelle_url": "https://gewerbeverein-ilshofen.de/mitgliederverzeichnis/",
        })

    # --- Stadt Ilshofen ---
    for s in st:
        strasse, ort = split_adresse(s["anschrift"])
        merged = {
            "firma": s["firma"],
            "ansprechpartner": "",
            "strasse": strasse,
            "ort": ort,
            "telefon": s["telefon"],
            "email": "",
            "website": s["website"],
            "kategorie": s["kategorie"],
            "quelle": "Stadt Ilshofen Firmenliste",
            "quelle_url": s["detail_url"] or "https://www.ilshofen.de/wirtschaft/firmenliste",
        }
        hit = next((r for r in rows if sim(r["firma"], s["firma"]) >= 0.6), None)
        if hit:
            for f, v in merged.items():
                if v and not hit.get(f):
                    hit[f] = v
            hit["quelle"] += " + Stadt Ilshofen"
        else:
            rows.append(merged)

    # --- Dedupe innerhalb des Gewerbevereins ---
    final = []
    for r in rows:
        dup = next((f for f in final if sim(f["firma"], r["firma"]) >= 0.85), None)
        if dup:
            for k, v in r.items():
                if v and not dup.get(k):
                    dup[k] = v
        else:
            final.append(r)

    with open("ilshofen-merged.json", "w", encoding="utf-8") as fh:
        json.dump(final, fh, ensure_ascii=False, indent=2)

    print(f"GV-Eintraege:            {len(gv)}")
    print(f"Stadt-Eintraege:         {len(st)}")
    print(f"nach Ilshofen-Filter:    {len(rows)}")
    print(f"nach Dedupe:             {len(final)}")
    ohne = [r for r in final if not r["website"]]
    print(f"ohne Website (Quellen):  {len(ohne)}")
    print(f"mit Website:             {len(final) - len(ohne)}")


if __name__ == "__main__":
    main()