#!/usr/bin/env python3
"""Check stage-1 output against the hand-timed TTMLs in assets/hymns/.

    python3 validate.py <hymnal-slug> <number> <ttml-path>

Fits the score's beat grid to the recording's word times and reports residuals.
Three models are compared, mirroring the analysis in docs/ttml-from-scores.md:
offset+tempo alone, plus a per-verse breath, plus a per-line-end hold (the
fermatas hymnals put at phrase ends).
"""

from __future__ import annotations

import json
import subprocess
import sys
import unicodedata
import xml.etree.ElementTree as ET

NS = {"t": "http://www.w3.org/ns/ttml"}
FOLD = str.maketrans({"ţ": "t", "ț": "t", "ş": "s", "ș": "s", "’": "'", "‘": "'"})


def norm(s: str) -> str:
    s = unicodedata.normalize("NFC", s.lower()).translate(FOLD)
    return "".join(c for c in s if c.isalnum())


def secs(v: str) -> float:
    p = v.split(":")
    return float(p[0]) * 60 + float(p[1]) if len(p) == 2 else \
        float(p[0]) * 3600 + float(p[1]) * 60 + float(p[2])


def lstsq(A: list[list[float]], y: list[float]) -> list[float]:
    m = len(A[0])
    M = [[sum(A[k][i] * A[k][j] for k in range(len(A))) for j in range(m)]
         + [sum(A[k][i] * y[k] for k in range(len(A)))] for i in range(m)]
    for i in range(m):
        piv = max(range(i, m), key=lambda r: abs(M[r][i]))
        M[i], M[piv] = M[piv], M[i]
        for r in range(m):
            if r != i and abs(M[i][i]) > 1e-12:
                f = M[r][i] / M[i][i]
                for c in range(i, m + 1):
                    M[r][c] -= f * M[i][c]
    return [M[i][m] / M[i][i] if abs(M[i][i]) > 1e-12 else 0.0 for i in range(m)]


def main() -> int:
    hymnal, number, ttml_path = sys.argv[1], sys.argv[2], sys.argv[3]
    raw = subprocess.run([sys.executable, "extract.py", hymnal, number],
                         capture_output=True, text=True, check=True).stdout
    sc = json.loads(raw)

    # Predicted schedule: verses in `sequence` order, each a full pass of the tune.
    seq = sc.get("sequence") or list(range(len(sc["blocks"])))
    by_index = {b["index"] - 1: b for b in sc["blocks"]}
    pred: list[tuple[str, float, int, int]] = []  # text, beat, verse#, lines done
    line_no = 0
    for vi, blk_id in enumerate(seq):
        blk = by_index.get(blk_id)
        if blk is None:
            continue
        for li, line in enumerate(blk["lines"]):
            for w in line["words"]:
                pred.append((w["text"], vi * sc["melodyBeats"] + w["beat"], vi, line_no))
            line_no += 1

    gt: list[tuple[str, float]] = []
    for p in ET.parse(ttml_path).findall(".//t:p", NS):
        for sp in p.findall("t:span", NS):
            gt.append(((sp.text or "").strip(), secs(sp.get("begin"))))

    if len(pred) != len(gt):
        print(f"!! word count differs: score={len(pred)} ttml={len(gt)}")
    n = min(len(pred), len(gt))
    mism = [(pred[i][0], gt[i][0]) for i in range(n) if norm(pred[i][0]) != norm(gt[i][0])]
    print(f"words: score={len(pred)} ttml={len(gt)}  text mismatches={len(mism)}")
    for a, b in mism[:6]:
        print(f"   score={a!r} ttml={b!r}")
    if n == 0:
        return 1

    beats = [pred[i][1] for i in range(n)]
    verses = [pred[i][2] for i in range(n)]
    linesd = [pred[i][3] for i in range(n)]
    y = [gt[i][1] for i in range(n)]

    models = {
        "A offset+tempo": [[1.0, b] for b in beats],
        "B +verse breath": [[1.0, b, float(v)] for b, v in zip(beats, verses)],
        "C +line-end hold": [[1.0, b, float(v), float(li)] for b, v, li in zip(beats, verses, linesd)],
    }
    for name, A in models.items():
        c = lstsq(A, y)
        res = [yy - sum(ci * ai for ci, ai in zip(c, row)) for row, yy in zip(A, y)]
        rms = (sum(r * r for r in res) / len(res)) ** 0.5
        bpm = 60.0 / c[1] if c[1] else 0
        print(f"  {name:18s} rms={rms:5.3f}s  max={max(abs(r) for r in res):5.3f}s  "
              f"tempo={bpm:5.1f} bpm  offset={c[0]:6.2f}s"
              + (f"  breath={c[2]:5.2f}s" if len(c) > 2 else "")
              + (f"  hold={c[3]:5.2f}s" if len(c) > 3 else ""))

    print(f"  measure check: {sc['confidence']['measuresOk']}/{sc['confidence']['measuresChecked']}"
          f"  warnings={sc['confidence']['warnings']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
