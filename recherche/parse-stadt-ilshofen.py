#!/usr/bin/env python3
"""Parst die Firmenliste der Stadt Ilshofen (TYPO3-Extension hwfirma2) aus Roh-HTML."""

import glob
import json
import re
from html import unescape

TAG = re.compile(r"<[^>]+>")
BR = re.compile(r"<br\s*/?>", re.I)


def text(raw):
    raw = BR.sub("\n", raw)
    raw = TAG.sub(" ", raw)
    return "\n".join(
        re.sub(r"\s+", " ", ln).strip() for ln in unescape(raw).split("\n") if ln.strip()
    )


def block(rec):
    o = {}
    m = re.search(r'hw_record__title"><span>(.*?)</span>', rec, re.S)
    o["firma"] = text(m.group(1)) if m else ""

    m = re.search(r'hw_record__categories__wrap"><span[^>]*>(.*?)</span>', rec, re.S)
    o["kategorie"] = text(m.group(1)) if m else ""

    m = re.search(r'hw_record__simpleLocation.*?hw_iconlist__text">(.*?)</span>', rec, re.S)
    o["anschrift"] = text(m.group(1)) if m else ""

    m = re.search(r'hw_record__organizer.*?hw_iconlist__text">(.*?)</span>', rec, re.S)
    o["telefon"] = text(m.group(1)) if m else ""

    m = re.search(r'href="(https?://[^"]+)"[^>]*class="hw_record__website', rec)
    o["website"] = m.group(1).strip() if m else ""

    m = re.search(r'id="hwfirma2__record__(\d+)"', rec)
    o["stadt_id"] = int(m.group(1)) if m else 0

    m = re.search(r'href="(/wirtschaft/firmenliste/\d+/[^"]+)"', rec)
    o["detail_url"] = ("https://www.ilshofen.de" + m.group(1)) if m else ""

    return o


def main():
    rows = []
    for f in sorted(glob.glob("ilshofen-s*.html")):
        src = open(f, encoding="utf-8", errors="replace").read()
        page = int(re.search(r"seite-(\d+)", f).group(1)) if re.search(r"seite-(\d+)", f) else 0
        for rec in re.findall(
            r'<div class="hw_fe__record hwfirma2__record".*?(?=<div class="hw_fe__record hwfirma2__record"|</main>)',
            src,
            re.S,
        ):
            r = block(rec)
            if r["firma"]:
                r["seite"] = page
                rows.append(r)

    seen, uniq = set(), []
    for r in rows:
        k = r["firma"].lower()
        if k in seen:
            continue
        seen.add(k)
        uniq.append(r)

    with open("stadt-ilshofen.json", "w", encoding="utf-8") as fh:
        json.dump(uniq, fh, ensure_ascii=False, indent=2)

    mit = [r for r in uniq if r["website"]]
    ohne = [r for r in uniq if not r["website"]]
    print(f"Eintraege: {len(uniq)}")
    print(f"  mit Website:  {len(mit)}")
    print(f"  ohne Website: {len(ohne)}")
    for r in ohne:
        print(f"   - {r['firma']} | {r['kategorie']} | {r['telefon']}")


if __name__ == "__main__":
    main()