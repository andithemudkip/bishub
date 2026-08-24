#!/usr/bin/env python3
"""Rank generated hymns by how confidently they aligned, for review.

    python3 report.py <stage2-report.json> [--scores DIR] [--top N]

Nothing here is ground truth -- with one hand-timed hymn left there is no way to
measure accuracy across the corpus. These are self-consistency signals, useful
for choosing what to listen to first and what to distrust:

  margin   how far the winning alignment beat a genuinely different start.
           Relative, so compare within a run, never across runs.
  tail     seconds of recording left after the last word. A few seconds is a
           normal outro; a lot means a verse's worth of audio went unexplained.
  measures stage 1's own check: did the note durations add up to the barlines.
"""
from __future__ import annotations

import argparse, json, os


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("report")
    ap.add_argument("--scores", default=None)
    ap.add_argument("--top", type=int, default=12)
    args = ap.parse_args()

    with open(args.report, encoding="utf-8") as fh:
        rows = json.load(fh)
    ok = [r for r in rows if r.get("status") == "ok"]

    stage1: dict[str, dict] = {}
    if args.scores:
        for r in ok:
            p = os.path.join(args.scores, f"{int(r['number'])}.json")
            if os.path.exists(p):
                with open(p, encoding="utf-8") as fh:
                    d = json.load(fh)
                stage1[r["number"]] = {
                    "title": d.get("title", ""),
                    "measures": d["confidence"]["score"],
                    "warnings": len(d["confidence"]["warnings"]),
                }

    def grade(r: dict) -> float:
        s1 = stage1.get(r["number"], {})
        tail_ok = 1.0 if -2.0 <= r.get("tailSeconds", 99) <= 25.0 else 0.0
        return r.get("margin", 0) * 10 + tail_ok + s1.get("measures", 0)

    ranked = sorted(ok, key=grade, reverse=True)
    print(f"generated {len(ok)} of {len(rows)}\n")

    def show(rs, label):
        print(f"--- {label}")
        print(f"    {'#':>4}  {'margin':>6} {'tail':>6} {'meas':>5}  title")
        for r in rs:
            s1 = stage1.get(r["number"], {})
            print(f"    {r['number']:>4}  {r.get('margin', 0):6.3f} "
                  f"{r.get('tailSeconds', 0):6.1f} {s1.get('measures', 0):5.2f}  "
                  f"{s1.get('title', '')[:44]}")
        print()

    show(ranked[:args.top], f"most confident {args.top} — expect these to be right")
    show(ranked[-args.top:], f"least confident {args.top} — check these first")

    bad_tail = [r for r in ok if not -2.0 <= r.get("tailSeconds", 99) <= 25.0]
    print(f"summary: {len(ok)} generated")
    print(f"  margin >= 0.04              {sum(1 for r in ok if r.get('margin', 0) >= 0.04):4d}")
    print(f"  implausible tail            {len(bad_tail):4d}")
    if stage1:
        print(f"  stage-1 measures all clean  "
              f"{sum(1 for r in ok if stage1.get(r['number'], {}).get('measures') == 1.0):4d}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
