# Generating karaoke TTML from the hymnal score PDFs

Research notes + design, so this doesn't need re-deriving. Written 2026-08-18.

## Problem

Karaoke TTML (`assets/hymns/*.ttml` → bundled into `assets/hymns-ttml.json`) is currently
hand-timed word by word against the MP3 instrumentals. Two exist (001, 003); there are ~1300
hymns across 6 Romanian hymnals. Hand-timing does not scale.

Source material: `/Users/andrei/Downloads/mybible/hymns/pdfs/{hymnal-slug}/{number}.pdf`

| hymnal | PDFs |
|---|---|
| imnuri-crestine | 920 |
| imnuri-exploratori | 150 |
| imnuri-licurici | 86 |
| imnuri-tineret | 69 |
| imnuri-companioni | 63 |
| imnuri-amicus | 36 |

There is **no MIDI, MusicXML or LilyPond source** anywhere in the MyBible data (checked). The
PDFs are the only machine-readable score.

## Finding 1 — the PDFs are LilyPond vector output, and glyph names survive

Not scans. `pdffonts` on `imnuri-crestine/1.pdf`:

```
IYYFKS+Emmentaler-18   Type 1C   Custom   emb sub
```

Emmentaler is LilyPond's music font. The embedded CFF subset **keeps real glyph names** —
`fontTools.cffLib.CFFFontSet` on the extracted font yields 43 glyphs for hymn 1:

```
noteheads.s0 (whole)  noteheads.s1 (half)  noteheads.s2 (black = quarter or shorter)
flags.u3 / flags.d3 (8th)   flags.u4 / flags.d4 (16th)   dots.dot (augmentation)
rests.0 rests.1 rests.2 rests.3 rests.4 rests.0o rests.1o
scripts.ufermata scripts.dfermata scripts.segno scripts.umarcato scripts.rcomma
clefs.G clefs.F  accidentals.*  brackettips.*  one two three four six eight nine (time sigs)
```

The CFF `Encoding` gives code → glyph name (e.g. `167 → noteheads.s2`, which is why
`pdftotext` renders every notehead as `§`). So: **glyph name + x/y is directly addressable.**

Beams and stems are not glyphs — they are filled paths in `page.get_drawings()`. Hymn 1 page 1:
417 `re` (staff lines, stems, barlines, horizontal beams) + 6 `qu` quads (slanted beams) +
24 `c` curves (slurs/ties). Duration of a beamed note therefore requires **counting beam
layers above/below the stem x**, since `noteheads.s2` alone can't distinguish 4th/8th/16th.

Lyrics come out of the text layer already hyphen-split into syllables, and LilyPond x-aligns
each syllable to its notehead — so syllable→note is an x-proximity match within a staff system.
Verses are stacked under one staff (`1. Ple ca ţi vă…` / `2. Ve niţi…`), so one melody
extraction yields every verse. Hymns are strophic; this is a large win.

Reproduce the above with:
```bash
pip install pymupdf fonttools
```

## Finding 2 — the pianist is near-metronomic, so offset + tempo is enough

The MP3 instrumentals are **real piano, played from this same sheet music** (Drive exports,
renamed by `scripts/rename-mp3s.js`, uploaded to S3 by `scripts/upload-assets.js`). So the
question is how much a human drifts from constant tempo.

Measured against the two hand-timed TTMLs, fitting models to line-start times (hymn 001 is
strophic 4×4 lines, so the same musical material recurs and drift is directly visible):

| model | hymn 001 | hymn 003 |
|---|---|---|
| offset + one global tempo | rms 0.36s, worst 0.75s | rms 0.41s, worst 0.90s |
| + per-verse breath term | rms 0.20s, worst 0.41s | rms 0.26s, worst 0.80s |
| anchor each verse start | rms 0.11s, worst 0.24s | rms 0.24s, worst 0.74s |

Part of that residual is the human annotator's own imprecision, so true pianist drift is *at
most* this. Conclusion:

- **Offset alone is NOT enough** — the score says "Moderato", no BPM, so tempo is unknown and
  must come from the recording.
- **Offset + tempo IS enough.** Two anchors (first sung syllable, last sung syllable) determine
  both by fitting, landing at ~0.4s rms. Per-verse anchors halve it.
- **No DSP / forced alignment on the MP3s is required.** Score→MIDI→chroma-DTW against the
  audio would handle ritardandi and structure automatically, but the numbers above say it's
  optimization, not necessity. Keep it in the back pocket.

Known systematic error: the largest single residual in hymn 003 was the **final line, +0.80s**
— final ritardando. Worth special-casing.

Per-recording facts the score cannot supply, which need a human eye:
- how many verses the pianist actually played
- intro length (this is the offset — 17.6s for hymn 001, 13.2s for hymn 003)
- whether there are interludes between verses

## Design — two stages

Deliberately split so retiming a hymn never means re-parsing a PDF.

**How to actually run it** — `scripts/score-extract/README.md` holds the ordered runbook:
which command, from which directory, in what order, how to test locally without publishing, and
which steps to repeat after a correction. This document is the *why*; that one is the *how*.

**Stage 1 · `pdf → score.json`** — BUILT, see `scripts/score-extract/` and its README.
Python (pymupdf + fontTools). Emits every word of every verse with a **beat offset**
(tempo-free), plus verse/chorus sections, meter and a confidence score.

**Stage 2 · `score.json + recording → ttml`** — BUILT, `scripts/score-extract/stage2.py`.
Anchors are derived automatically rather than tapped by hand: the score's own onset pattern is
located inside the recording, which fixes tempo and intro offset together. Each verse/chorus is
then placed individually, plus one hymn-wide term stretching the printed fermatas.
Generated TTML vs the hand-timed hymn 003: **rms 0.180s, 95% of words within 0.3s** — better
than the hand-fitted model in Finding 2, and fully automatic. Still to do: feed the output
through `scripts/build-ttml-bundle.js`.

**Two kinds of evidence, because rhythm alone is not enough.** Matching on onsets cannot place a
tune whose every note is the same length — a uniform pulse fits anywhere at the right tempo, and
hymn 001 is exactly that. Stage 2 therefore also matches **pitch**: notehead staff positions give
each note a MIDI pitch (clef + key signature read from the accidentals' own staff positions), and
those are correlated against a chromagram. Chroma makes an octave error free, and a twelve-way
transposition match up front handles pianists transposing for congregational range — hymn 003's
recording sounds 10 semitones off the printed key.

Pitch alone still cannot separate the verses of a *strophic* hymn, which are musically identical.
What does is structure: a performance fills its recording. Candidates are therefore also generated
by working back from the end, and that is what places hymn 001 correctly (offset 16.58s, hold
1.50s, 5.6s tail on a 147.1s recording).

**What listening found that the metrics could not.** A first round of testing in the app
surfaced two failures, neither visible in any self-consistency number:

1. *Whole-bar slips.* The melody of one bar fits the next bar's audio nearly as well. For hymn
   004 the three candidates a bar apart scored 6.662 / 6.576 / 6.667 and the shipped one was the
   worst — not because scoring preferred it, but because no candidate seed reached the best.
   Fixed by re-running the walk from the winner shifted by ±1 and ±2 bars.
2. *First verse misplaced, rest correct* (hymn 313) — the per-block walk recovering by block 2.
   Softened by penalising a long intro more than a long tail, tuned to the mildest ratio (2.5 vs
   1.5) that fixes it; pushed to 4.0/0.5 it over-corrects and hymn 195 collapses to a 4.6s intro.

Note the limitation this exposes: sliding a whole hymn by a bar leaves block spacing perfectly
even, so *no* aggregate metric here detects it. Between two runs where 266 hymns moved, the
"first verse off-step" count went 98 → 90. Only listening finds these.

**Corrections are made in the app, by ear.** `Settings → Timing tuning` adds a timing row to the
hymn transport bar; nudges apply to the projected display live (`applyLyricsTuning` in
`src/shared/ttmlParser.ts`, used by both `KaraokeMode` and the main process's slide advancement,
so screens change on the words they show). Saved corrections land in `userData/lyric-tuning.json`
and `npm run pull-lyric-tuning` folds them into the generator's `overrides.json`. Offsets cover
the common whole-hymn shift; keyframes cover what one offset cannot. A keyframe anchors to the
word at the playhead and shifts it and everything after, and they accumulate — the finest
correction the timing model can express, since a word is its smallest unit.

**Hand corrections beat more tuning.** Four successive heuristics were tried against the two
reported failures, and each fixed one hymn while breaking another (intro penalty fixed 313 and
collapsed 195 to a 0.8s intro; a plausibility band fixed 195 and lost 313; leave-one-out repair
fixed 313 and undid 004's bar shift; a tighter tolerance then rewrote three of 004's four
blocks). With one ground-truth hymn and a couple of anecdotes there is not enough signal to tune
further without overfitting. `scripts/score-extract/overrides.json` therefore records a
listener's correction per hymn — `shift` in seconds, or an absolute `offset` — applied after the
fit and immune to later heuristics. That is the "then review" half of the approach, and it is
where the residual should be spent rather than on a fifth prior.

**Ground truth is down to one hymn.** `mp3-source/` is canonical and the old TTMLs were timed
against superseded recordings, so 001 can no longer be scored — its cached recording is 157.647s
against 146.9s in source. 003 is unaffected (207.023s in both), and it is the number to trust:
**rms 0.180s, 95% of words within 0.3s**. Corpus-wide figures (97% of 150 hymns align in a way
that uses the recording sensibly) are self-consistency proxies, not accuracy; calibrating them
needs a spot-check in the app.

### What stage 1 turned out to need

Three decisions did most of the work, and are worth keeping if it is ever rewritten:

- **Columns, not voices.** Everything sounding at one x is a column lasting as long as its
  shortest note. Isolating the soprano (the original plan) needs voice separation, which breaks
  whenever a hymnal engraves the upper parts as one stemmed chord rather than two voices.
- **Durations from differences.** A syllable lasts until the *next* syllable's onset, so ties,
  slurs and melismas need no handling — three of the "hard parts" below evaporated.
- **Words from the hymnal JSON, timing from the PDF.** LilyPond draws a real word-hyphen
  ("Plecați-vă") identically to a syllable-break hyphen, so the PDF cannot spell words. The two
  letter streams are aligned instead (fuzzily — the engraved edition and the shipped text differ
  slightly in places, see `docs/hymn-merge-report.md`).

Barlines are ground truth the engraver already supplied: each measure is checked against the
meter, and any measure that disagrees is rescaled, so one misread note cannot drag the rest of
the hymn out of place. On hymn 003 that correction measurably *improved* agreement with the
hand-timed ground truth (rms 0.238s → 0.212s).

Bugs that cost the most to find, all of them silent:

- `get_texttrace` bboxes are font-metric boxes — every glyph in a span shares a height. Vertical
  position must come from the glyph **origin**; for a notehead that is its centre.
- One drawn beam arrives up to three times (a quad, a filled polygon, rect strips). Count beam
  *layers* by clustering crossing heights, never by tallying paths.
- Horizontal beams are plain rects and fall through a naive line/stem classifier entirely.
- Augmentation dots for a chord stack in one x-slot, one per note; they must be paired with
  noteheads in vertical order or the top note swallows both and reads as double-dotted.
- Text baselines jitter ~0.1pt, so rounding to a fixed precision tears a lyric row in half at the
  rounding boundary. Cluster baselines instead. (Fixing this alone took corpus alignment from
  68% to 80.5%.)
- Some scores print no time signature at all. Infer the measure length from barline spacing.

Still unhandled: hymns whose extra verses are printed as prose below the score (no note
alignment possible), some multi-section forms, and grace notes.

### Validation harness

`assets/hymns/001.ttml` and `003.ttml` are hand-timed ground truth;
`scripts/score-extract/validate.py` fits the generated beat grid to them.

| hymn | words | rms | max |
|---|---|---|---|
| 001 | 73/73 exact | 0.237s | 0.789s |
| 003 | 118/118 exact | 0.212s | 0.517s |

Both under the 0.3s target. Corpus-wide (1239 hymns with engraved music): 80.5% have every
verse aligned and timed, 64.2% have all measures checking out, 44.0% are clean on both counts.
`batch.py --report` writes the full survey so the tail is identifiable rather than silently
wrong.

## TTML output format

See `assets/hymns/001.ttml`. Word-level (`composer:timing="Word"`), `<p>` per line with
`begin`/`end`, `<span>` per word. Times are `M:SS.mmm`. Consumed by
`src/shared/ttmlParser.ts` → `TextState.syncedLyrics`.
