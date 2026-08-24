#!/usr/bin/env python3
"""Run stage 2 over many hymns and report how confidently each one aligned.

    python3 batch2.py --scores DIR --mp3 DIR [--out DIR] [--limit N]

`margin` is the discriminating number: how far the winning alignment beat a
genuinely different starting position. A rhythmically uniform tune matches
almost anywhere at the right tempo, so its margin collapses -- that is the
signal to review it by hand rather than trust the timing.
"""
from __future__ import annotations

import argparse, glob, json, os, sys
from concurrent.futures import ProcessPoolExecutor

import stage2


def one(job):
    score_path, mp3_path, out_dir, overrides = job
    # Zero-padded: build-ttml-bundle.js keys the bundle on the filename, and
    # electron/hymnAssets.ts looks hymns up by their padded number.
    num = os.path.splitext(os.path.basename(score_path))[0].zfill(3)
    try:
        ttml, info = stage2.run(score_path, mp3_path, overrides)
    except Exception as exc:  # noqa: BLE001
        return {"number": num, "status": f"{type(exc).__name__}: {exc}"}
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
        with open(os.path.join(out_dir, f"{num}.ttml"), "w", encoding="utf-8") as fh:
            fh.write(ttml)
    return {"number": num, "status": "ok", **info}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--scores", required=True)
    ap.add_argument("--mp3", required=True)
    ap.add_argument("--out", default=None)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--report", default=None)
    ap.add_argument("--jobs", type=int, default=os.cpu_count() or 4)
    ap.add_argument("--overrides", default=None)
    args = ap.parse_args()

    overrides = stage2.load_overrides(args.overrides)
    if overrides:
        print(f"{len(overrides)} hand correction(s) loaded", file=sys.stderr)
    jobs = []
    for sp in sorted(glob.glob(os.path.join(args.scores, "*.json"))):
        num = os.path.splitext(os.path.basename(sp))[0]
        mp3 = os.path.join(args.mp3, f"{num.zfill(3)}.mp3")
        if os.path.exists(mp3):
            jobs.append((sp, mp3, args.out, overrides))
    if args.limit:
        jobs = jobs[:args.limit]
    print(f"{len(jobs)} hymns, {args.jobs} workers", file=sys.stderr)

    with ProcessPoolExecutor(max_workers=args.jobs) as ex:
        res = list(ex.map(one, jobs, chunksize=2))

    ok = [r for r in res if r["status"] == "ok"]
    # Verses are the same length and the pauses between them are similar, so a
    # correct alignment spaces its blocks evenly. A first interval out of step
    # with the rest is the signature of the common failure: verse 1 misplaced
    # against the pianist's intro while everything after it is right.
    for r in ok:
        st = r.get("blockStarts") or []
        iv = [round(st[i + 1] - st[i], 3) for i in range(len(st) - 1)]
        r["intervals"] = iv
        if len(iv) >= 3:
            rest = sorted(iv[1:])[len(iv[1:]) // 2]
            r["firstIntervalRatio"] = round(iv[0] / rest, 3) if rest else 0.0
            mean = sum(iv) / len(iv)
            var = sum((x - mean) ** 2 for x in iv) / len(iv)
            r["intervalCV"] = round(var ** 0.5 / mean, 3) if mean else 0.0
    print(f"\naligned: {len(ok)} / {len(res)}")
    for r in res:
        if r["status"] != "ok":
            print(f"  failed {r['number']}: {r['status']}", file=sys.stderr)
    if ok:
        for lo in (0.10, 0.06, 0.04, 0.02):
            n = sum(1 for r in ok if r["margin"] >= lo)
            print(f"  margin >= {lo:.2f}: {n:4d} ({100*n/len(ok):3.0f}%)")
        tail = [r for r in ok if -2.0 <= r["tailSeconds"] <= 25.0]
        print(f"  ends plausibly close to the recording's end: "
              f"{len(tail)} ({100*len(tail)/len(ok):.0f}%)")
        odd_first = [r for r in ok if "firstIntervalRatio" in r
                     and not 0.85 <= r["firstIntervalRatio"] <= 1.15]
        uneven = [r for r in ok if r.get("intervalCV", 0) > 0.12]
        print(f"  first verse out of step with the rest: {len(odd_first)} "
              f"({100*len(odd_first)/max(1,len(ok)):.0f}%)")
        print(f"  unevenly spaced blocks (CV > 0.12):    {len(uneven)} "
              f"({100*len(uneven)/max(1,len(ok)):.0f}%)")
        print(f"  hand-corrected: {sum(1 for r in ok if r.get('override'))}")
    if args.report:
        with open(args.report, "w", encoding="utf-8") as fh:
            json.dump(res, fh, ensure_ascii=False, indent=1)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
