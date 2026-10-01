#!/usr/bin/env python3
"""Parst das Mitgliederverzeichnis des Gewerbevereins Ilshofen aus Roh-HTML."""

import json
import re
import sys
from html import unescape

TAG = re.compile(r"<[^>]+>")
BR = re.compile(r"<br\s*/?>", re.I)
LINK = re.compile(r"<a\b[^>]*href=[\"']([^\"']+)[\"'][^>]*>(.*?)</a>", re.I | re.S)


def text(raw):
    raw = BR.sub("\n", raw)
    raw = TAG.sub(" ", raw)
    raw = unescape(raw)
    lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in raw.split("\n")]
    return "\n".join(ln for ln in lines if ln)


def block(entry):
    """Zerlegt einen mitglied-entry-Block in ein dict."""
    out = {}

    m = re.search(r'class="mitglied-firma">(.*?)</h2>', entry, re.S)
    out["firma"] = text(m.group(1)).strip() if m else ""

    m = re.search(r'class="mitglied-plzort">(.*?)</div>', entry, re.S)
    out["plz_ort"] = text(m.group(1)).strip() if m else ""

    m = re.search(r'class="mitglied-info"><span>(.*?)</span>', entry, re.S)
    out["ansprechpartner"] = text(m.group(1)).strip() if m else ""

    m = re.search(r'mitglied-adresse.*?<span>(.*?)</span>', entry, re.S)
    out["anschrift"] = text(m.group(1)).strip() if m else ""

    m = re.search(r'mitglied-kontakt-telefon.*?class="datavalue">(.*?)</span>', entry, re.S)
    out["telefon"] = text(m.group(1)).strip() if m else ""

    m = re.search(r'mitglied-kontakt-fax.*?class="datavalue">(.*?)</span>', entry, re.S)
    out["fax"] = text(m.group(1)).strip() if m else ""

    emails = []
    websites = []
    if "mitglied-kontakt-website" in entry:
        m = re.search(r'mitglied-kontakt-website(.*?)</div>\s*</div>', entry, re.S)
        for href, label in LINK.findall(m.group(1) if m else ""):
            href, label = href.strip(), text(label).strip()
            if href.startswith("mailto:"):
                emails.append(unescape(href[7:].split("?")[0]))
            elif href.startswith(("http://", "https://")) and label:
                websites.append(label if label.startswith(("http://", "https://")) else href)
            elif href and "@" in href:
                emails.append(href)
    out["email"] = "; ".join(dict.fromkeys(e for e in emails if e))
    out["website"] = "; ".join(dict.fromkeys(w for w in websites if w))

    if not out["email"]:
        m = re.search(r'mitglied-kontakt-email.*?<span[^>]*>(.*?)</span>', entry, re.S)
        blob = text(m.group(1)).strip() if m else ""
        hit = re.search(r"[\w.+-]+@[\w.-]+\.[a-z]{2,}", blob, re.I)
        out["email"] = hit.group(0) if hit else ""

    return out


def main():
    src = open(sys.argv[1] if len(sys.argv) > 1 else "gv-raw.html", encoding="utf-8", errors="replace").read()
    entries = re.split(r'<div class="mitglied-entry">', src)[1:]
    entries = [e.split("<!-- Cleanup -->")[0].split("</main>")[0] for e in entries]

    rows = [block(e) for e in entries]
    rows = [r for r in rows if r["firma"]]

    with open("gewerbeverein.json", "w", encoding="utf-8") as fh:
        json.dump(rows, fh, ensure_ascii=False, indent=2)

    mit = [r for r in rows if r["website"]]
    ohne = [r for r in rows if not r["website"]]
    ilshofen = [r for r in rows if "ilshofen" in (r["plz_ort"] + r["anschrift"]).lower()]

    print(f"Eintraege gesamt:      {len(rows)}")
    print(f"  mit Website:        {len(mit)}")
    print(f"  ohne Website:       {len(ohne)}")
    print(f"  Ort nennt Ilshofen: {len(ilshofen)}")
    ohne_ilshofen = [r for r in ilshofen if not r["website"]]
    print(f"  davon ohne Website: {len(ohne_ilshofen)}")


if __name__ == "__main__":
    main()