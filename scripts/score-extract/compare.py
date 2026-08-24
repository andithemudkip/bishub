#!/usr/bin/env python3
"""Compare a generated TTML against a hand-timed one, word by word."""
from __future__ import annotations
import sys, unicodedata, xml.etree.ElementTree as ET

NS = {"t": "http://www.w3.org/ns/ttml"}
FOLD = str.maketrans({"ţ": "t", "ț": "t", "ş": "s", "ș": "s", "’": "'"})


def norm(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFC", s.lower()).translate(FOLD)
                   if c.isalnum())


def secs(v: str) -> float:
    p = v.split(":")
    return float(p[0]) * 60 + float(p[1])


def words(path):
    return [((sp.text or "").strip(), secs(sp.get("begin")))
            for p in ET.parse(path).findall(".//t:p", NS)
            for sp in p.findall("t:span", NS)]


gen, ref = words(sys.argv[1]), words(sys.argv[2])
print(f"generated {len(gen)} words, reference {len(ref)} words")
n = min(len(gen), len(ref))
bad = [i for i in range(n) if norm(gen[i][0]) != norm(ref[i][0])]
if bad:
    print(f"  !! {len(bad)} text mismatches, first: {gen[bad[0]][0]!r} vs {ref[bad[0]][0]!r}")
d = [gen[i][1] - ref[i][1] for i in range(n)]
d_abs = sorted(abs(x) for x in d)
print(f"  mean offset {sum(d)/n:+.3f}s   rms {(sum(x*x for x in d)/n)**.5:.3f}s   "
      f"median |err| {d_abs[n//2]:.3f}s   p90 {d_abs[int(n*0.9)]:.3f}s   max {d_abs[-1]:.3f}s")
print(f"  within 0.3s: {100*sum(1 for x in d_abs if x<=0.3)/n:.0f}%   "
      f"within 0.5s: {100*sum(1 for x in d_abs if x<=0.5)/n:.0f}%")
worst = sorted(range(n), key=lambda i: -abs(d[i]))[:5]
for i in worst:
    print(f"    {gen[i][0]!r}: gen {gen[i][1]:.2f} vs ref {ref[i][1]:.2f}  ({d[i]:+.2f}s)")
