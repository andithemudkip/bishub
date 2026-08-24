#!/usr/bin/env python3
"""Run stage 1 over a whole hymnal and report how much of it extracts cleanly.

    python3 batch.py [hymnal ...] [--out DIR] [--jobs N] [--pdf-root DIR]

Writes one score JSON per hymn (when --out is given) and prints a summary of
the confidence signal, so the tail needing manual review is identifiable.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import sys
from concurrent.futures import ProcessPoolExecutor

import extract

HYMNALS = ["imnuri-crestine", "imnuri-exploratori", "imnuri-licurici",
           "imnuri-tineret", "imnuri-companioni", "imnuri-amicus"]


def run_one(job: tuple[str, str, str, str | None]) -> dict:
    hymnal, number, pdf_root, out_dir = job
    pdf = os.path.join(pdf_root, hymnal, f"{number}.pdf")
    rec = {"hymnal": hymnal, "number": number}
    try:
        piece = extract.build_piece(pdf)
        if not piece.columns:
            rec["status"] = "no-music"
            return rec
        hymn = extract.load_hymn_json(hymnal, number)
        if hymn is None:
            rec["status"] = "no-json"
            return rec
        blocks, warns = extract.align_to_text(piece, hymn)
        total = piece.measures_ok + piece.measures_bad
        rec.update({
            "status": "ok",
            "measuresOk": piece.measures_ok,
            "measuresTotal": total,
            "measureScore": piece.measures_ok / total if total else 0.0,
            "blocksExpected": len(hymn.get("blocks", [])),
            "blocksAligned": len(blocks),
            "hardLyric": [w for w in warns if "do not match" in w
                          or "no lyric" in w or "no section" in w],
            "softLyric": [w for w in warns if "differ slightly" in w],
            "beats": piece.total_beats,
        })
        if out_dir and blocks:
            payload = extract.build_result(piece, hymn, blocks, warns, hymnal, number)
            os.makedirs(os.path.join(out_dir, hymnal), exist_ok=True)
            with open(os.path.join(out_dir, hymnal, f"{number}.json"), "w",
                      encoding="utf-8") as fh:
                json.dump(payload, fh, ensure_ascii=False, indent=1)
    except Exception as exc:  # noqa: BLE001 - a crash is a result, not a stop
        rec["status"] = "error"
        rec["error"] = f"{type(exc).__name__}: {exc}"
    return rec


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("hymnals", nargs="*", default=None)
    ap.add_argument("--pdf-root", default=extract.DEFAULT_PDF_ROOT)
    ap.add_argument("--out", default=None)
    ap.add_argument("--jobs", type=int, default=os.cpu_count() or 4)
    ap.add_argument("--report", default=None)
    args = ap.parse_args()

    jobs: list[tuple[str, str, str, str | None]] = []
    for hymnal in (args.hymnals or HYMNALS):
        for pdf in sorted(glob.glob(os.path.join(args.pdf_root, hymnal, "*.pdf"))):
            jobs.append((hymnal, os.path.splitext(os.path.basename(pdf))[0],
                         args.pdf_root, args.out))
    print(f"{len(jobs)} hymns, {args.jobs} workers", file=sys.stderr)

    with ProcessPoolExecutor(max_workers=args.jobs) as ex:
        results = list(ex.map(run_one, jobs, chunksize=8))

    by_status: dict[str, int] = {}
    for r in results:
        by_status[r["status"]] = by_status.get(r["status"], 0) + 1
    print("\nstatus:", by_status)

    ok = [r for r in results if r["status"] == "ok"]
    aligned = [r for r in ok if r["blocksAligned"] == r["blocksExpected"]]
    clean = [r for r in aligned if r["measureScore"] == 1.0 and not r["softLyric"]]
    meas_bad = [r for r in ok if r["measureScore"] < 1.0]
    print(f"parsed:              {len(ok)}")
    print(f"all blocks aligned:  {len(aligned)}  ({100*len(aligned)/max(1,len(ok)):.1f}%)")
    print(f"fully clean:         {len(clean)}  ({100*len(clean)/max(1,len(ok)):.1f}%)")
    print(f"measure errors:      {len(meas_bad)}")
    print(f"unaligned blocks:    {len(ok)-len(aligned)}")
    print(f"approx text (soft):  {sum(1 for r in ok if r['softLyric'])}")

    buckets = {"1.00": 0, ">=0.95": 0, ">=0.85": 0, ">=0.5": 0, "<0.5": 0}
    for r in ok:
        sc = r["measureScore"]
        key = "1.00" if sc == 1.0 else ">=0.95" if sc >= .95 else \
              ">=0.85" if sc >= .85 else ">=0.5" if sc >= .5 else "<0.5"
        buckets[key] += 1
    print("measure score:", buckets)

    if args.report:
        with open(args.report, "w", encoding="utf-8") as fh:
            json.dump(results, fh, ensure_ascii=False, indent=1)
        print(f"wrote {args.report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
