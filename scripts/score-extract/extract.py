#!/usr/bin/env python3
"""Stage 1 of the karaoke pipeline: hymn score PDF -> tempo-free score JSON.

    python3 extract.py <hymnal-slug> <number> [--pdf-root DIR] [--json PATH]

Emits, on stdout, the melody as words carrying **beat offsets** (quarter notes
from the start of one pass through the tune). Stage 2 turns those into TTML by
applying an offset and a tempo measured from the recording -- see
docs/ttml-from-scores.md.

Word spelling and line breaks come from the shipped hymnal JSON, not the PDF:
LilyPond draws a real word-hyphen ("Plecați-vă") and a syllable-break hyphen
identically, so the PDF cannot distinguish them. The PDF's syllable stream is
aligned to the JSON text by letter sequence, so the PDF supplies only timing.
"""

from __future__ import annotations

import argparse
import bisect
import difflib
import json
import os
import sys
import unicodedata
from dataclasses import dataclass, field

import scoredoc
import score as S

DEFAULT_PDF_ROOT = os.path.expanduser("~/Downloads/mybible/hymns/pdfs")
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# The PDFs use cedilla forms where the hymnal JSON uses the correct
# comma-below Romanian letters; fold them together for matching only.
# Below this letter-sequence similarity the PDF row is assumed to be different
# text altogether (wrong row, wrong section) rather than an edition variant.
TEXT_MATCH_MIN = 0.90

FOLD = str.maketrans({"ţ": "t", "ț": "t", "ş": "s", "ș": "s", "’": "'", "‘": "'"})


def norm(text: str) -> str:
    # Lowercase first: the fold table only lists lowercase forms, and the PDFs
    # use cedilla letters (ş/ţ) where the hymnal JSON uses comma-below (ș/ț).
    text = unicodedata.normalize("NFC", text.lower()).translate(FOLD)
    return "".join(c for c in text if c.isalnum())


@dataclass
class Column:
    """One melodic onset: an x position on a system, and its beat."""

    system: int
    x: float
    beat: float
    dur: float
    fermata: bool = False
    is_rest: bool = False
    midi: int | None = None


@dataclass
class SystemInfo:
    index: int
    start_beat: float
    end_beat: float
    rows: dict[int, list[S.Syllable]] = field(default_factory=dict)
    repeat_of: int | None = None   # same lyrics as an earlier system => music repeats


@dataclass
class Section:
    """A stretch of systems carrying the same number of lyric rows.

    Hymnals engrave the verses under the opening systems (one row per verse) and
    the chorus under the systems that follow (a single row). The row count is
    what marks the boundary, and each section is its own pass of melody, so word
    beats are stored relative to the section rather than the page.
    """

    kind: str
    systems: list[SystemInfo]
    start_beat: float
    beats: float

    @property
    def n_rows(self) -> int:
        return max((len(s.rows) for s in self.systems), default=0)


def _interp(x: float, xs: list[float], ys: list[float]) -> float:
    """Linear interpolation of x through a monotonic (xs -> ys) map."""
    if x <= xs[0]:
        lo, hi = 0, 1
    elif x >= xs[-1]:
        lo, hi = len(xs) - 2, len(xs) - 1
    else:
        lo = 0
        hi = len(xs) - 1
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if xs[mid] <= x:
                lo = mid
            else:
                hi = mid
    span = xs[hi] - xs[lo]
    if abs(span) < 1e-9:
        return ys[lo]
    return ys[lo] + (ys[hi] - ys[lo]) * (x - xs[lo]) / span


@dataclass
class Piece:
    columns: list[Column] = field(default_factory=list)
    total_beats: float = 0.0
    timesig: tuple[int, int] = (4, 4)
    systems: list[SystemInfo] = field(default_factory=list)
    sections: list[Section] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    measures_ok: int = 0
    measures_bad: int = 0
    corrected: int = 0
    beats_per_measure: float = 4.0

    @property
    def verses(self) -> dict[int, list[S.Syllable]]:
        """All rows merged by index -- kept for quick inspection/debugging."""
        out: dict[int, list[S.Syllable]] = {}
        for sysinfo in self.systems:
            for k, v in sysinfo.rows.items():
                out.setdefault(k, []).extend(v)
        return out


def build_piece(pdf_path: str) -> Piece:
    pages, _ = scoredoc.load(pdf_path)
    piece = Piece()
    piece.timesig = S.time_signature(pages)
    beats_per_measure = piece.timesig[0] * 4.0 / piece.timesig[1]

    beat = 0.0
    sys_index = 0
    bar_beats: list[float] = []

    for pg in pages:
        staves = S.find_staves(pg)
        if not staves:
            continue
        S.assign_clefs(staves, pg.glyphs)
        systems = S.group_systems(pg, staves)

        for i, sysst in enumerate(systems):
            melody = sysst[0]
            notes, barlines = S.extract_notes(pg, sysst, staves)
            sop = S.columns(notes, melody.space)
            if not sop:
                continue

            local: list[Column] = []
            b = beat
            for n in sop:
                local.append(Column(sys_index, n.x, b, n.dur, n.fermata,
                                    n.is_rest, n.midi))
                b += n.dur
            # Barline positions on the global beat axis. Checking the *gaps*
            # between them (rather than absolute positions) tolerates both an
            # anacrusis and a measure that runs across a system break.
            for bx in barlines:
                bar_beats.append(beat + sum(c.dur for c in local if c.x < bx - 0.5))
            piece.columns.extend(local)
            beat = b

            # Whatever staff comes next already bounds the lyric block; only the
            # very last system needs an artificial floor to keep the credits out.
            if len(sysst) > 1:
                next_top = sysst[1].top
            elif i + 1 < len(systems):
                next_top = systems[i + 1][0].top
            else:
                next_top = melody.bottom + melody.space * 20

            info = SystemInfo(sys_index, local[0].beat, b)
            note_xs = [c.x + melody.space * 0.62 for c in local]
            for v, syls in S.extract_lyrics(pg, sysst, next_top, note_xs).items():
                for syl in syls:
                    syl.system = sys_index  # type: ignore[attr-defined]
                info.rows[v] = syls
            piece.systems.append(info)

            sys_index += 1

    # Some scores print no time signature at all, and a misread one throws off
    # every measure check. The barlines state the measure length directly, so
    # prefer the spacing they agree on when it contradicts the printed meter.
    inferred = _modal_measure(bar_beats)
    if inferred and abs(inferred - beats_per_measure) > 0.02:
        piece.warnings.append(
            f"barlines imply {inferred:g} beats per measure, not "
            f"{beats_per_measure:g} from the time signature - using the barlines")
        beats_per_measure = inferred
    piece.beats_per_measure = beats_per_measure

    # Validate: every span between barlines should be one measure. The opening
    # and closing spans are judged as a pair -- a tune that starts with an
    # anacrusis ends with a measure short by exactly that much.
    uniq = sorted({round(x, 4) for x in bar_beats if x > 0.001})
    if uniq:
        segs = [uniq[0]] + [hi - lo for lo, hi in zip(uniq, uniq[1:])]
        tail = beat - uniq[-1]
        if tail > 0.01:
            segs.append(tail)
        eps = 0.02
        interior = list(zip(uniq, segs[1:-1]))
        i = 0
        while i < len(interior):
            lo, gap = interior[i]
            if abs(gap - beats_per_measure) < eps:
                piece.measures_ok += 1
                i += 1
                continue
            # A section that begins on an upbeat ends with a measure short by
            # exactly that upbeat, so two consecutive short measures adding up to
            # one are correct notation, not an extraction error.
            if i + 1 < len(interior):
                nxt = interior[i + 1][1]
                if gap < beats_per_measure and nxt < beats_per_measure and \
                   abs(gap + nxt - beats_per_measure) < eps:
                    piece.measures_ok += 1
                    i += 2
                    continue
            piece.measures_bad += 1
            piece.warnings.append(
                f"measure at beat {lo:g} is {gap:g} beats, "
                f"expected {beats_per_measure:g}")
            i += 1
        first, last = segs[0], segs[-1]
        if abs(first - beats_per_measure) < eps and abs(last - beats_per_measure) < eps:
            piece.measures_ok += 2
        elif abs(first + last - beats_per_measure) < eps:
            piece.measures_ok += 1
        else:
            piece.measures_bad += 1
            piece.warnings.append(
                f"opening {first:g} + closing {last:g} beats do not make a "
                f"{beats_per_measure:g}-beat measure")

    piece.total_beats = beat
    piece.corrected = normalize_to_measures(piece, bar_beats, beats_per_measure)
    for info in piece.systems:          # keep system spans on the corrected grid
        cols = [c for c in piece.columns if c.system == info.index]
        if cols:
            info.start_beat = cols[0].beat
            info.end_beat = max(c.beat + c.dur for c in cols)
    piece.sections = sectionize(piece.systems)
    return piece


def _modal_measure(bar_beats: list[float]) -> float | None:
    """The measure length the barline spacing agrees on, if it agrees."""
    uniq = sorted({round(b, 4) for b in bar_beats})
    gaps = [round(hi - lo, 4) for lo, hi in zip(uniq, uniq[1:]) if hi - lo > 0.01]
    if len(gaps) < 4:
        return None
    counts: dict[float, int] = {}
    for g in gaps:
        counts[g] = counts.get(g, 0) + 1
    best, n = max(counts.items(), key=lambda kv: kv[1])
    return best if n >= len(gaps) * 0.5 and best >= 1.0 else None


def normalize_to_measures(piece: Piece, bar_beats: list[float],
                          beats_per_measure: float) -> int:
    """Snap the beat grid back to the barlines, bounding any duration error.

    Onsets accumulate, so one misread note would otherwise drag every later
    syllable out of place for the rest of the hymn. Barlines are ground truth
    the engraver already gave us: rescaling each measure to its notated length
    confines the damage to the measure that contains the mistake.

    Segments that are already a whole number of measures are left alone, as are
    the opening and closing ones (an anacrusis makes both legitimately short).
    Returns how many measures had to be corrected.
    """
    eps = 0.02
    bounds = sorted({0.0} | {round(b, 4) for b in bar_beats} | {round(piece.total_beats, 4)})
    if len(bounds) < 3:
        return 0

    spans = list(zip(bounds, bounds[1:]))
    targets: list[float] = []
    i = 0
    while i < len(spans):
        lo, hi = spans[i]
        length = hi - lo
        first_or_last = i == 0 or i == len(spans) - 1
        whole = abs(length % beats_per_measure) < eps or             abs(length % beats_per_measure - beats_per_measure) < eps
        if whole or first_or_last:
            targets.append(length)
            i += 1
            continue
        nxt = spans[i + 1][1] - spans[i + 1][0] if i + 1 < len(spans) else None
        if nxt is not None and length < beats_per_measure and nxt < beats_per_measure            and abs(length + nxt - beats_per_measure) < eps:
            targets.extend([length, nxt])       # sectional anacrusis pair
            i += 2
            continue
        targets.append(beats_per_measure)
        i += 1

    corrected = sum(1 for (lo, hi), t in zip(spans, targets) if abs((hi - lo) - t) > eps)
    if not corrected:
        return 0

    new_bounds = [0.0]
    for t in targets:
        new_bounds.append(new_bounds[-1] + t)

    for col in piece.columns:
        k = max(0, min(len(spans) - 1,
                       next((j for j, (lo, hi) in enumerate(spans) if col.beat < hi - 1e-9),
                            len(spans) - 1)))
        lo, hi = spans[k]
        frac = (col.beat - lo) / (hi - lo) if hi > lo else 0.0
        col.beat = new_bounds[k] + frac * (new_bounds[k + 1] - new_bounds[k])
    piece.total_beats = new_bounds[-1]
    return corrected


def _row_text(info: SystemInfo) -> str:
    return "|".join(norm("".join(s.text for s in info.rows[k]))
                    for k in sorted(info.rows))


def sectionize(systems: list[SystemInfo]) -> list[Section]:
    """Split systems into verse/chorus sections and flag musical repeats.

    Consecutive systems carrying the same number of lyric rows form one section;
    the first is the verses, later (smaller) ones the chorus. A system whose
    lyrics repeat the previous system's is a written-out musical repeat, not new
    text, and is marked so text alignment can skip it.
    """
    for i in range(1, len(systems)):
        prev, cur = systems[i - 1], systems[i]
        if cur.rows and _row_text(cur) == _row_text(prev):
            cur.repeat_of = prev.index

    groups: list[list[SystemInfo]] = []
    for info in systems:
        if groups and len(info.rows) == len(groups[-1][-1].rows):
            groups[-1].append(info)
        else:
            groups.append([info])

    # The verses are the group with the most lyric rows (one row per verse).
    # Everything engraved after it is the chorus -- kept as one section even if
    # its systems carry differing row counts, which row-count grouping splits.
    if not groups:
        return []
    vi = max(range(len(groups)), key=lambda i: len(groups[i][-1].rows))
    sections: list[Section] = []

    def add(kind: str, grp: list[SystemInfo]) -> None:
        sections.append(Section(kind, grp, grp[0].start_beat,
                                grp[-1].end_beat - grp[0].start_beat))

    if vi > 0:
        add("chorus", [s for g in groups[:vi] for s in g])
    add("verse", groups[vi])
    if vi + 1 < len(groups):
        add("chorus", [s for g in groups[vi + 1:] for s in g])
    return sections


def syllable_beats(piece: Piece, syls: list[S.Syllable]) -> list[float]:
    """Beat of each syllable, by matching its x to the melody column above it."""
    out: list[float] = []
    for s in syls:
        sysno = getattr(s, "system", 0)
        cands = [c for c in piece.columns if c.system == sysno]
        if not cands:
            out.append(0.0)
            continue
        target = s.cx
        best = min(cands, key=lambda c: abs((c.x + 2.9) - target))
        out.append(best.beat)
    return out


def load_hymn_json(hymnal: str, number: str) -> dict | None:
    path = os.path.join(REPO, "assets", "hymnals", f"{hymnal}.json")
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as fh:
        for h in json.load(fh):
            if str(h.get("number")) == str(number):
                return h
    return None


def align_to_text(piece: Piece, hymn: dict) -> tuple[list[dict], list[str]]:
    """Map the hymnal JSON's words onto PDF syllable beats.

    JSON verse blocks are matched to the verse section's rows in order and the
    chorus block to the chorus section, because the hymnal prints one lyric row
    per verse under the staff and the chorus separately. Within a block, the
    concatenated letters of the JSON text must equal those of the PDF syllables;
    that exact match is what lets each word claim the beat of the syllable it
    starts on. Beats are relative to the block's own section.
    """
    warnings: list[str] = []
    blocks = hymn.get("blocks", [])
    verse_sec = next((s for s in piece.sections if s.kind == "verse"), None)
    chorus_secs = [s for s in piece.sections if s.kind == "chorus"]

    verse_ids = [i for i, b in enumerate(blocks) if b.get("kind") != "chorus"]
    chorus_ids = [i for i, b in enumerate(blocks) if b.get("kind") == "chorus"]

    assign: dict[int, tuple[Section, int]] = {}
    for k, bi in enumerate(verse_ids):
        if verse_sec is not None:
            assign[bi] = (verse_sec, k + 1)
    for k, bi in enumerate(chorus_ids):
        if chorus_secs:
            assign[bi] = (chorus_secs[min(k, len(chorus_secs) - 1)], 1)
        elif verse_sec is not None and verse_sec.n_rows > len(verse_ids):
            assign[bi] = (verse_sec, len(verse_ids) + k + 1)

    out: list[dict] = []
    for bi, block in enumerate(blocks):
        target = assign.get(bi)
        if target is None:
            warnings.append(f"block {bi + 1}: no section to match it to")
            continue
        section, row = target

        live = [s for s in section.systems if s.repeat_of is None]
        syls: list[S.Syllable] = []
        for info in live:
            syls.extend(info.rows.get(row, []))
        if not syls:
            warnings.append(f"block {bi + 1}: no lyric row {row} in the PDF")
            continue

        beats = syllable_beats(piece, syls)
        owner: list[int] = []
        for i, syl in enumerate(syls):
            owner.extend([i] * len(norm(syl.text)))
        pdf_letters = "".join(norm(s.text) for s in syls)

        lines = [ln for ln in block.get("text", "").split("\n") if norm(ln)]
        json_letters = "".join(norm(ln) for ln in lines)

        # The shipped hymnal text and the engraved edition are not always
        # identical (see docs/hymn-merge-report.md), so align the two letter
        # streams rather than demanding equality: a handful of differing words
        # should cost a confidence point, not the whole hymn's timing.
        matcher = difflib.SequenceMatcher(None, json_letters, pdf_letters,
                                          autojunk=False)
        ratio = matcher.ratio()
        if ratio < TEXT_MATCH_MIN:
            warnings.append(
                f"block {bi + 1}: PDF lyrics do not match the hymnal JSON "
                f"(similarity {ratio:.2f}, {len(pdf_letters)} vs "
                f"{len(json_letters)} letters)")
            continue
        if ratio < 1.0:
            warnings.append(
                f"block {bi + 1}: lyrics differ slightly from the hymnal JSON "
                f"(similarity {ratio:.2f}) - timings interpolated")

        j2p: list[int | None] = [None] * (len(json_letters) + 1)
        for i, j, n in matcher.get_matching_blocks():
            for k in range(n):
                j2p[i + k] = j + k
        last = 0
        for i in range(len(j2p)):          # carry the last known anchor forward
            if j2p[i] is None:
                j2p[i] = last
            else:
                last = j2p[i]

        pos = 0
        jlines: list[dict] = []
        for ln in lines:
            words = []
            for w in ln.split():
                n = len(norm(w))
                if n == 0:
                    continue
                pi = min(j2p[pos], len(owner) - 1)
                si = owner[pi]
                words.append({"text": w,
                              "beat": round(beats[si] - section.start_beat, 4)})
                pos += n
            if words:
                jlines.append({"text": ln, "beat": words[0]["beat"], "words": words})

        # A written-out repeat sings the same lines again further along the
        # staff; re-emit them shifted by the distance between the two systems.
        for info in section.systems:
            if info.repeat_of is None:
                continue
            src = next((x for x in section.systems if x.index == info.repeat_of), None)
            if src is None:
                continue
            shift = info.start_beat - src.start_beat
            lo = src.start_beat - section.start_beat
            hi = src.end_beat - section.start_beat
            for ln in list(jlines):
                if lo - 0.01 <= ln["beat"] < hi - 0.01:
                    jlines.append({
                        "text": ln["text"], "beat": round(ln["beat"] + shift, 4),
                        "repeat": True,
                        "words": [{"text": w["text"], "beat": round(w["beat"] + shift, 4)}
                                  for w in ln["words"]],
                    })
        jlines.sort(key=lambda l: l["beat"])

        out.append({"index": bi + 1, "kind": block.get("kind", "verse"),
                    "section": section.kind, "textMatch": round(ratio, 4),
                    "sectionBeats": round(section.beats, 4), "lines": jlines})

    return out, warnings


def build_result(piece: Piece, hymn: dict, blocks: list[dict],
                 warns: list[str], hymnal: str, number: str) -> dict:
    """The stage-1 payload. Shared with batch.py so the two cannot drift."""
    total_m = piece.measures_ok + piece.measures_bad
    return {
        "hymnal": hymnal,
        "number": str(number),
        "title": hymn.get("title"),
        "timeSignature": list(piece.timesig),
        "beatsPerMeasure": piece.beats_per_measure,
        "beatUnit": "quarter",
        "melodyBeats": round(piece.total_beats, 4),
        "sections": [{"kind": sec.kind, "startBeat": round(sec.start_beat, 4),
                      "beats": round(sec.beats, 4), "rows": sec.n_rows}
                     for sec in piece.sections],
        # Every rhythmic onset in the score, absolute beats. Stage 2 matches these
        # against note onsets detected in the recording to fit tempo and offset,
        # so it needs the whole grid, not only the beats that carry a word.
        "onsets": [round(c.beat, 4) for c in sorted(piece.columns, key=lambda c: c.beat)
                   if not c.is_rest],
        # Pitch of each onset, aligned index-for-index with `onsets`. Stage 2
        # matches these against a chromagram, which is what lets it place a tune
        # whose rhythm alone is too uniform to locate.
        "pitches": [c.midi for c in sorted(piece.columns, key=lambda c: c.beat)
                    if not c.is_rest],
        # Notes the hymnal marks to be held. Stage 2 needs them: a fermata at the
        # end of every phrase adds real seconds that no tempo can account for.
        "fermatas": [round(c.beat, 4) for c in sorted(piece.columns, key=lambda c: c.beat)
                     if c.fermata],
        "sequence": hymn.get("sequence"),
        "blocks": blocks,
        "confidence": {
            "measuresChecked": total_m,
            "measuresOk": piece.measures_ok,
            "score": round(piece.measures_ok / total_m, 3) if total_m else 0.0,
            "measuresCorrected": piece.corrected,
            "warnings": warns + piece.warnings,
        },
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("hymnal")
    ap.add_argument("number")
    ap.add_argument("--pdf-root", default=DEFAULT_PDF_ROOT)
    ap.add_argument("--out", default="-")
    args = ap.parse_args()

    pdf = os.path.join(args.pdf_root, args.hymnal, f"{args.number}.pdf")
    if not os.path.exists(pdf):
        print(f"no such PDF: {pdf}", file=sys.stderr)
        return 1

    piece = build_piece(pdf)
    hymn = load_hymn_json(args.hymnal, args.number)
    if hymn is None:
        print(f"hymn {args.hymnal}/{args.number} not in assets/hymnals", file=sys.stderr)
        return 1

    blocks, warns = align_to_text(piece, hymn)
    result = build_result(piece, hymn, blocks, warns, args.hymnal, str(args.number))
    text = json.dumps(result, ensure_ascii=False, indent=2)
    if args.out == "-":
        print(text)
    else:
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write(text + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
