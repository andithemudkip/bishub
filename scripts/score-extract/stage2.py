#!/usr/bin/env python3
"""Stage 2: score JSON + instrumental MP3 -> karaoke TTML.

    python3 stage2.py <score.json> <recording.mp3> [--out FILE]

The score carries a tempo-free beat grid; the recording supplies the two numbers
it is missing. Rather than beat-tracking the audio blind, this locates the
score's *own* onset pattern in the recording -- we know exactly which rhythm to
look for, which pins tempo and intro offset down together far more tightly than
matching a generic pulse.

Each verse and chorus is then placed on its own, so the pauses between them and
the pianist's drift are absorbed locally. One further parameter, shared by the
whole hymn, stretches the fermatas the hymnal prints at phrase ends.

Two approaches were tried and rejected, both recorded here so they are not
retried: a single global (offset, tempo, per-verse pause) line is degenerate --
a slightly slow tempo imitates an accumulating pause -- and giving every line
its own free offset and tempo overfits, scoring well on wrong alignments.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

import numpy as np

import audio

GRID = 0.01                     # seconds per correlation bin
# Unsung time is penalised asymmetrically. A long tail is ordinary -- an outro,
# or a recording that sings more verses than the hymnal prints. A long intro is
# not: it almost always means the whole performance was placed a verse late.
# Empirical prior on structure, taken from the corpus's own distribution: intros
# cluster tightly (p25 11.2s, median 13.0s, p75 16.8s of 841 hymns). Penalising
# intro *length* linearly was tried and fails in both directions -- it drags
# hymns down to sub-second intros, which no piano recording has. Penalising
# departure from the plausible band instead corrects both a verse-late start and
# a start buried in the intro.
INTRO_MIN, INTRO_MAX = 6.0, 26.0
INTRO_PENALTY = 2.5
TAIL_MAX = 25.0
TAIL_PENALTY = 1.5
SPB_MIN, SPB_MAX = 0.30, 1.60


def clock(t: float) -> str:
    t = max(0.0, t)
    return f"{int(t // 60)}:{t % 60:06.3f}"


def _esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def build_performance(score: dict):
    """Expand the score into the order it is actually performed.

    `sequence` lists blocks in performance order, so a chorus sung after every
    verse appears once in `blocks` but many times on the timeline.
    """
    by_index = {b["index"] - 1: b for b in score["blocks"]}
    sections = {s["kind"]: s for s in score.get("sections", [])}
    onsets_all = score.get("onsets", [])
    pitch_all = score.get("pitches") or []
    ferm_all = score.get("fermatas", [])
    pitch_of = {round(o, 4): p for o, p in zip(onsets_all, pitch_all)
                if p is not None}
    seq = [i for i in (score.get("sequence") or sorted(by_index)) if i in by_index]

    grid: list[tuple[float, int | None]] = []
    fermatas: list[float] = []
    words: list[dict] = []
    spans: list[tuple[float, float]] = []
    cursor = 0.0

    for block_no, blk_id in enumerate(seq):
        blk = by_index[blk_id]
        sec = sections.get(blk.get("section", "verse"))
        span = blk.get("sectionBeats") or (sec or {}).get("beats") or 0.0
        if sec:
            lo = sec["startBeat"]
            grid.extend((cursor + (o - lo), pitch_of.get(round(o, 4)))
                        for o in onsets_all if lo - 1e-6 <= o < lo + span - 1e-6)
            fermatas.extend(cursor + (f - lo) for f in ferm_all
                            if lo - 1e-6 <= f < lo + span - 1e-6)
        for line in blk["lines"]:
            for w in line["words"]:
                words.append({"text": w["text"], "beat": cursor + w["beat"],
                              "block": block_no, "line": id(line)})
        spans.append((cursor, span))
        cursor += span

    grid.sort(key=lambda g: g[0])
    beats = np.array([g[0] for g in grid])
    pitches = (np.array([g[1] if g[1] is not None else 0 for g in grid])
               if any(g[1] is not None for g in grid) else None)
    return beats, pitches, np.array(sorted(fermatas)), words, spans, cursor


def _structure_penalty(intro: float, tail: float, duration: float) -> float:
    """How implausible this placement's intro and tail are, as a score penalty.

    Zero inside the bands; outside, proportional to how far out it is. Scaled by
    the recording's length so it stays comparable to the mean-evidence score.
    """
    short = max(0.0, INTRO_MIN - intro)
    long_ = max(0.0, intro - INTRO_MAX)
    over = max(0.0, tail - TAIL_MAX)
    return (INTRO_PENALTY * (short + long_) + TAIL_PENALTY * over) / max(duration, 1e-9)


def _held(fermatas: np.ndarray, beats: np.ndarray, since: float) -> np.ndarray:
    """How many held notes fall between `since` and each beat."""
    if fermatas.size == 0:
        return np.zeros(beats.shape)
    return (np.searchsorted(fermatas, beats, side="left")
            - np.searchsorted(fermatas, since, side="left")).astype(float)


class Ear:
    """The recording, prepared for scoring a candidate alignment.

    Combines two independent kinds of evidence: an onset-strength curve (does a
    note start here?) and a chromagram (is that note's pitch sounding?). Rhythm
    alone cannot place a tune whose notes are all the same length, and pitch
    alone is vague about exactly when a note begins; together they are sharp.
    Both terms are divided by their own mean so neither scale dominates.
    """

    def __init__(self, mp3_path: str):
        y = audio.decode(mp3_path)
        self.duration = y.size / audio.SAMPLE_RATE
        env, env_t = audio.onset_envelope(y)
        w = 25
        pad = np.pad(env, (w, w), mode="edge")
        win = np.lib.stride_tricks.sliding_window_view(pad, 2 * w + 1)
        det = np.maximum(env - np.median(win, axis=1), 0.0)
        self.det = det / det.max() if det.size and det.max() > 0 else det
        self.det_t = env_t
        self.det_mean = float(self.det.mean()) if self.det.size else 1.0
        self.chroma, self.chroma_t = audio.chromagram(mp3_path, y)
        self.shift = 0

    def set_transposition(self, pitches: np.ndarray, weights: np.ndarray) -> int:
        """Match the score's pitch-class profile to the recording's.

        Pianists transpose hymns for congregational range, so the printed key is
        not necessarily the sounding one. Comparing the two overall profiles
        settles it in twelve cheap comparisons, instead of carrying the unknown
        into the far more expensive position search.
        """
        if self.chroma.size == 0 or pitches.size == 0:
            return 0
        hist = np.zeros(12)
        np.add.at(hist, pitches % 12, weights)
        hist = hist / hist.sum() if hist.sum() else hist
        heard = self.chroma.mean(axis=1)
        heard = heard / heard.sum() if heard.sum() else heard
        self.shift = int(np.argmax([float(np.dot(np.roll(hist, r), heard))
                                    for r in range(12)]))
        return self.shift

    def score(self, when: np.ndarray, pcs: np.ndarray | None) -> np.ndarray:
        """Mean evidence per candidate; `when` is (candidates x notes)."""
        vals = np.interp(when.ravel(), self.det_t, self.det, left=0.0, right=0.0)
        total = vals.reshape(when.shape).mean(axis=1) / max(self.det_mean, 1e-9)
        if pcs is not None and self.chroma.size:
            hop = self.chroma_t[1] - self.chroma_t[0] if self.chroma_t.size > 1 else 0.01
            idx = np.clip(np.round((when - self.chroma_t[0]) / hop).astype(int),
                          0, self.chroma.shape[1] - 1)
            rows = (pcs + self.shift) % 12
            total = total + 12.0 * self.chroma[rows[None, :], idx].mean(axis=1)
        return total


def _scan(grid: np.ndarray, extra: np.ndarray, pcs, ear: "Ear",
          offsets: np.ndarray, spbs: np.ndarray) -> tuple[float, float, float]:
    """Best (offset, secondsPerBeat, evidence) over a search range."""
    best = (float(offsets[0]), float(spbs[0]), -1.0)
    for spb in spbs:
        pred = offsets[:, None] + (spb * grid + extra)[None, :]
        scores = ear.score(pred, pcs)
        k = int(np.argmax(scores))
        if scores[k] > best[2]:
            best = (float(offsets[k]), float(spb), float(scores[k]))
    return best


def locate_first(grid: np.ndarray, pcs, ear: "Ear",
                 duration: float, total_beats: float,
                 n: int = 4) -> list[tuple[float, float, float]]:
    """Candidate positions and tempi for the first sung block.

    Several candidates, not one: the piano intro is usually a phrase of the same
    tune, so the verse pattern genuinely matches there too. Both are real peaks,
    and only playing the whole performance forward tells them apart.
    """
    zero = np.zeros(grid.shape)
    found: list[tuple[float, float, float]] = []
    for spb in np.linspace(SPB_MIN, SPB_MAX, 66):
        span = total_beats * spb
        # The performance must fit the recording and account for most of it.
        if span > duration or span < 0.45 * duration:
            continue
        offsets = np.arange(0.0, max(0.5, duration - span) + 0.05, 0.05)
        scores = ear.score(offsets[:, None] + (spb * grid)[None, :], pcs)
        for k in _top_peaks(scores, 3, int(1.5 / 0.05)):
            found.append((float(offsets[k]), float(spb), float(scores[k])))

    found.sort(key=lambda c: -c[2])
    picked: list[tuple[float, float, float]] = []
    for cand in found:
        if all(abs(cand[0] - p[0]) > 1.5 for p in picked):
            picked.append(cand)
        if len(picked) >= n:
            break
    return [_scan(grid, zero, pcs, ear,
                  np.arange(max(0.0, o - 0.8), o + 0.8, 0.01),
                  spb * (1.0 + np.linspace(-0.08, 0.08, 49)))
            for o, spb, _ in picked]


def _top_peaks(sig: np.ndarray, count: int, min_sep: int) -> list[int]:
    out: list[int] = []
    work = sig.astype(float).copy()
    for _ in range(count):
        if work.size == 0:
            break
        k = int(np.argmax(work))
        if not np.isfinite(work[k]):
            break
        out.append(k)
        work[max(0, k - min_sep):k + min_sep] = -np.inf
    return out


def walk(spans, grid, pitches, fermatas, ear, offset, spb, hold):
    """Place each verse/chorus in turn, seeded by where the previous one ended."""
    models: list[tuple[float, float, float]] = []
    prev_end = None
    for start, length in spans:
        sel = (grid >= start - 1e-6) & (grid < start + length - 1e-6)
        local, extra = grid[sel] - start, hold * _held(fermatas, grid[sel], start)
        pcs = pitches[sel] if pitches is not None else None
        centre = offset if prev_end is None else prev_end
        if local.size < 4:
            models.append((centre, spb, 0.0))
        else:
            o, s, strength = _scan(
                local, extra, pcs, ear,
                np.arange(max(0.0, centre - 4.0), centre + 4.0, 0.02),
                spb * (1.0 + np.linspace(-0.07, 0.07, 29)))
            models.append((o, s, strength))
            spb = s
        o, s, _ = models[-1]
        held_total = float(_held(fermatas, np.array([start + length]), start)[0])
        prev_end = o + s * length + hold * held_total
    return models


def rigid_shift(spans, models, delta, grid, pitches, fermatas, ear, hold,
                window: float = 0.7):
    """Translate every block by `delta`, then polish each within a small window."""
    out = []
    for k, (o, sp, _) in enumerate(models):
        start, length = spans[k]
        target = o + delta
        if target < 0:
            return None
        sel = (grid >= start - 1e-6) & (grid < start + length - 1e-6)
        if sel.sum() < 4:
            out.append((target, sp, 0.0))
            continue
        out.append(_scan(
            grid[sel] - start, hold * _held(fermatas, grid[sel], start),
            pitches[sel] if pitches is not None else None, ear,
            np.arange(max(0.0, target - window), target + window, 0.02),
            sp * (1.0 + np.linspace(-0.02, 0.02, 9))))
    return out


def enforce_consistency(spans, models, grid, pitches, fermatas, ear, hold,
                        tolerance: float = 2.5):
    """Re-place any block that disagrees with where the *others* imply it sits.

    Verses are the same length and the pauses between them are similar, so block
    starts lie on a straight line in cumulative beats. The prediction for each
    block is made leave-one-out -- fitted on every other block -- because a block
    included in its own fit drags the line toward itself and hides exactly the
    error being looked for. In hymn 313 that masking was total: with equal-length
    blocks, cumulative beats and block index are perfectly collinear, so the
    three-parameter fit was rank-deficient and the late first verse looked
    ordinary. Fitted without it, its position is predicted to within 0.2s.

    The tolerance is deliberately loose. Verse spacing varies by a second or so
    naturally, and at 1.0s this rewrote three of hymn 004's four blocks into an
    artificial regularity that undid a correct whole-bar shift; the error it
    exists to catch (hymn 313) is 4.4s.

    This deliberately overrides the audio evidence: the misplaced block usually
    scores *better* where it wrongly sits, which is how it got there. The
    assumption traded in exchange is that verse spacing is regular.
    """
    n = len(models)
    if n < 4:
        return models, 0
    starts = np.array([m[0] for m in models])
    cum = np.array([s[0] for s in spans], dtype=float)
    idx = np.arange(n, dtype=float)
    spb = float(np.median([m[1] for m in models]))

    fixed = list(models)
    repaired = 0
    for k in range(n):
        others = [j for j in range(n) if j != k]
        A = np.column_stack([np.ones(len(others)), cum[others], idx[others]])
        coef, *_ = np.linalg.lstsq(A, starts[others], rcond=None)
        predicted = float(np.array([1.0, cum[k], idx[k]]) @ coef)
        if predicted < 0 or abs(predicted - starts[k]) <= tolerance:
            continue
        start, length = spans[k]
        sel = (grid >= start - 1e-6) & (grid < start + length - 1e-6)
        if sel.sum() < 4:
            continue
        o, sp, strength = _scan(
            grid[sel] - start, hold * _held(fermatas, grid[sel], start),
            pitches[sel] if pitches is not None else None, ear,
            np.arange(max(0.0, predicted - 1.2), predicted + 1.2, 0.02),
            spb * (1.0 + np.linspace(-0.04, 0.04, 17)))
        fixed[k] = (o, sp, strength)
        repaired += 1
    return fixed, repaired


def _word_deltas(breakpoints, count: int) -> list[float]:
    """Cumulative shift for each word, from keyframes anchored by word index.

    Mirrors `applyLyricsTuning` in src/shared/ttmlParser.ts exactly, so a
    correction dialled in by ear in the app reproduces when baked in here.
    """
    out = [0.0] * count
    running = 0.0
    ordered = sorted(breakpoints, key=lambda b: b.get("fromWord", 0))
    cursor = 0
    for i in range(count):
        while cursor < len(ordered) and ordered[cursor].get("fromWord", 0) <= i:
            running += float(ordered[cursor].get("delta", 0.0))
            cursor += 1
        out[i] = running
    return out


def to_ttml(score, words, spans, fermatas, models, hold, duration,
            breakpoints=None) -> str:
    def t_of(w):
        start, _ = spans[w["block"]]
        o, s, _ = models[w["block"]]
        held = float(_held(fermatas, np.array([w["beat"]]), start)[0])
        return o + s * (w["beat"] - start) + hold * held

    lines: list[list[dict]] = []
    for w in words:
        if lines and lines[-1][0]["line"] == w["line"]:
            lines[-1].append(w)
        else:
            lines.append([w])

    flat = [w for ln in lines for w in ln]
    deltas = _word_deltas(breakpoints or [], len(flat))
    starts = [t_of(w) + d for w, d in zip(flat, deltas)]
    tail = models[-1][1] * 2 if models else 1.0
    ends = starts[1:] + [starts[-1] + tail if starts else 0.0]

    title = f'{score.get("number", "")}. {score.get("title", "")}'.strip()
    body, k = [], 0
    for ln in lines:
        n = len(ln)
        spans_xml = [f'<span begin="{clock(starts[k + i])}" end="{clock(ends[k + i])}">'
                     f'{_esc(ln[i]["text"])}</span>' for i in range(n)]
        body.append(f'<p begin="{clock(starts[k])}" end="{clock(ends[k + n - 1])}" '
                    f'ttm:agent="v1">{" ".join(spans_xml)}</p>')
        k += n

    return ('<tt xmlns="http://www.w3.org/ns/ttml" '
            'xmlns:ttm="http://www.w3.org/ns/ttml#metadata" '
            'xmlns:ttp="http://www.w3.org/ns/ttml#parameter" '
            'xmlns:composer="https://composer.boidu.dev/ttml" '
            'ttp:timeBase="media" xml:lang="ro" composer:timing="Word">'
            f'<head><metadata><ttm:title>{_esc(title)}</ttm:title>'
            '<ttm:agent xml:id="v1" type="person"><ttm:name>Lead</ttm:name></ttm:agent>'
            f'</metadata></head><body dur="{clock(duration)}"><div>'
            + "".join(body) + '</div></body></tt>')


def load_overrides(path: str | None) -> dict:
    """Hand corrections, keyed by zero-padded hymn number.

    The automatic fit is right most of the time and wrong in ways no
    self-consistency measure can detect -- a whole hymn shifted by a bar leaves
    every internal check perfectly happy. Rather than keep tuning priors against
    a handful of examples, a listener's correction is recorded here once and is
    never second-guessed by a later heuristic.

        {"004": {"shift": 2.8, "note": "was a bar early"},
         "313": {"offset": 12.15}}

    `shift` nudges the automatic result by N seconds (positive = later), which is
    usually the easier judgement to make by ear. `offset` states outright where
    the first sung word begins.
    """
    if path is None:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            "overrides.json")
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        return {}


def run(score_path: str, mp3_path: str, overrides: dict | None = None) -> tuple[str, dict]:
    with open(score_path, encoding="utf-8") as fh:
        score = json.load(fh)

    grid, pitches, fermatas, words, spans, total_beats = build_performance(score)
    beats_per_measure = score.get("beatsPerMeasure") or 4.0
    if grid.size == 0 or not words:
        raise ValueError("score has no onsets or no words")

    ear = Ear(mp3_path)
    duration = ear.duration
    if pitches is not None:
        ear.set_transposition(pitches, np.ones(pitches.size))

    # Localise on the opening phrase only -- everything up to the first held
    # note. The candidate search cannot know the hold length yet, and in a tune
    # that pauses at every phrase end (hymn 001) a hold-free pattern fits the
    # rest of the verse badly enough to miss the true entry entirely.
    first_len = spans[0][1] if spans else total_beats
    cut = float(fermatas[0]) + 1e-6 if fermatas.size else first_len
    mask = grid < min(cut, first_len) - 1e-9
    if mask.sum() < 6:
        mask = grid < first_len - 1e-6
    if mask.sum() < 4:
        mask = np.ones(grid.shape, dtype=bool)
    probe = grid[mask]
    probe_pcs = pitches[mask] if pitches is not None else None
    candidates = locate_first(probe, probe_pcs, ear, duration, total_beats, n=6)

    holds = [0.0] if fermatas.size == 0 else list(np.arange(0.0, 3.01, 0.25))

    # Structural candidates: a performance fills its recording, so once tempo and
    # hold are guessed the start is almost determined by working back from the
    # end. This is what finds strophic hymns, whose verses are musically
    # identical -- verse 1's pattern fits verse 2's audio just as well, and the
    # opening-phrase search can miss the true entry entirely.
    extra: list[tuple[float, float, float]] = []
    for _o, sp, sc in candidates[:3]:
        for hold in ((0.0,) if fermatas.size == 0 else (0.0, 0.75, 1.5, 2.25)):
            span = total_beats * sp + fermatas.size * hold
            for tail in (3.0, 9.0):
                off = duration - span - tail
                if off >= 0.0:
                    extra.append((off, sp, sc))
    for cand in extra:
        if all(abs(cand[0] - c[0]) > 1.5 for c in candidates):
            candidates.append(cand)
    scored: list[tuple[float, float]] = []      # (strength, offset) per candidate
    best = None
    for o, sp, _ in candidates:
        for hold in holds:
            models = walk(spans, grid, pitches, fermatas, ear, o, sp, hold)
            # Finalise before scoring. Running the consistency repair afterwards
            # lets it silently rewrite the winner into something that would have
            # lost, which is how hymn 004's correct whole-bar shift kept getting
            # undone.
            models, _rep = enforce_consistency(spans, models, grid, pitches,
                                               fermatas, ear, hold)
            # The singing cannot run past the end of the recording. Without this
            # the search happily buys a better-looking alignment by sliding the
            # whole performance off the end of the file.
            last_start, last_len = spans[-1]
            end = (models[-1][0] + models[-1][1] * last_len
                   + hold * float(_held(fermatas, np.array([last_start + last_len]),
                                        last_start)[0]))
            if end > duration + 0.5:
                continue
            vals = [m[2] for m in models if m[2] > 0]
            total = float(np.mean(vals)) if vals else 0.0
            # Prefer alignments that account for the recording. A strophic hymn
            # has verses that are musically identical, so verse 1's pattern fits
            # verse 2's audio just as well; what separates them is that the true
            # placement leaves only a short intro and tail unexplained, while the
            # shifted one abandons a whole verse of audio.
            total -= _structure_penalty(models[0][0], duration - end, duration)
            scored.append((total, models[0][0]))
            if best is None or total > best[0]:
                best = (total, models, hold, end)
    if best is None:
        raise ValueError("no alignment fits inside the recording")
    # The strongest remaining error is a whole-bar slip: the melody of bar N
    # often fits bar N+1's audio nearly as well, so the winner can sit a bar
    # early or late while every verse stays internally correct.
    #
    # The shift is applied rigidly to every block, then each is polished within a
    # narrow window. Re-seeding the walk instead does not work: only the first
    # block ends up moved, because the later ones re-converge inside their own
    # search windows onto the positions they already had -- which then reads as
    # an inconsistent first block and gets "repaired" straight back.
    bar = beats_per_measure * best[1][0][1] if best[1] else 0.0
    if bar > 0.05:
        for step in (-2, -1, 1, 2):
            moved = rigid_shift(spans, best[1], step * bar, grid, pitches,
                                fermatas, ear, hold=best[2])
            if moved is None:
                continue
            moved, _rep = enforce_consistency(spans, moved, grid, pitches,
                                              fermatas, ear, best[2])
            last_start, last_len = spans[-1]
            end = (moved[-1][0] + moved[-1][1] * last_len
                   + best[2] * float(_held(fermatas,
                                           np.array([last_start + last_len]),
                                           last_start)[0]))
            if end > duration + 0.5:
                continue
            vals = [m[2] for m in moved if m[2] > 0]
            total = float(np.mean(vals)) if vals else 0.0
            total -= _structure_penalty(moved[0][0], duration - end, duration)
            if total > best[0]:
                best = (total, moved, best[2], end)

    strength, models, hold, fit_end = best
    models, repaired = enforce_consistency(spans, models, grid, pitches,
                                           fermatas, ear, hold)  # no-op if settled

    # How clearly the winner beat a genuinely different starting position. A
    # rhythmically uniform tune (all quarter notes) matches almost anywhere at
    # the right tempo, so its margin collapses -- which is the signal that the
    # onset pattern alone cannot place it and a human should check.
    rivals = [sc for sc, off in scored if abs(off - models[0][0]) > 2.0]
    margin = (strength - max(rivals)) / strength if rivals and strength > 0 else 1.0

    # A hand correction wins outright over anything the fit decided.
    fix = (overrides or {}).get(str(score.get("number", "")).zfill(3), {})
    applied = None
    if fix:
        delta = None
        if "offset" in fix:
            delta = float(fix["offset"]) - models[0][0]
        elif "shift" in fix:
            delta = float(fix["shift"])
        if delta is not None and abs(delta) > 1e-6:
            # Translated exactly, with no re-fit. `rigid_shift` polishes each
            # block onto nearby onsets, which is right when the search proposes
            # a whole-bar move but wrong here: the operator set this value by
            # ear, and re-snapping it would both second-guess them and make the
            # baked result differ from what they heard while tuning.
            models = [(o + delta, sp, strength) for o, sp, strength in models]
            applied = round(delta, 3)
            fit_end = models[-1][0] + models[-1][1] * spans[-1][1]

    ttml = to_ttml(score, words, spans, fermatas, models, hold, duration,
                   fix.get("breakpoints"))
    bpms = [round(60.0 / m[1], 1) for m in models if m[1]]
    last = words[-1]
    info = {
        "offset": round(models[0][0], 3),
        "bpm": bpms[0] if bpms else 0.0,
        "bpmRange": [min(bpms), max(bpms)] if bpms else [],
        "hold": round(hold, 2),
        "fermatasPerPass": int(fermatas.size / max(1, len(spans))),
        "blocks": len(models),
        "blocksRepaired": repaired,
        "blockStarts": [round(m[0], 2) for m in models],
        "strength": round(strength, 4),
        "margin": round(float(margin), 4),
        "override": applied,
        "transposition": ear.shift,
        "duration": round(duration, 2),
        "tailSeconds": round(duration - fit_end, 2),
        "lastWordEnd": round(
            models[last["block"]][0]
            + models[last["block"]][1] * (last["beat"] - spans[last["block"]][0])
            + hold * float(_held(fermatas, np.array([last["beat"]]),
                                 spans[last["block"]][0])[0]), 2),
    }
    return ttml, info


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("score")
    ap.add_argument("mp3")
    ap.add_argument("--out", default=None)
    ap.add_argument("--overrides", default=None,
                    help="JSON of hand corrections (default: overrides.json here)")
    args = ap.parse_args()
    ttml, info = run(args.score, args.mp3, load_overrides(args.overrides))
    print(json.dumps(info, indent=2), file=sys.stderr)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write(ttml)
    else:
        print(ttml)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
