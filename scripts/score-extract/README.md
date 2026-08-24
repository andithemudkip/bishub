# score-extract — karaoke TTML from the hymnal score PDFs

**Stage 1** turns a LilyPond-engraved hymn score PDF into a tempo-free score
JSON: every word of every verse with a beat offset.
**Stage 2** locates that beat grid inside the MP3 instrumental and writes TTML.

Background, findings and the measured tempo analysis: `docs/ttml-from-scores.md`.

## Setup

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
```

## Running it end to end

Steps are in order; each says where to run it. Python steps run from
`scripts/score-extract/`, npm and file-copy steps from the repo root. Substitute
`.venv/bin/python` for `python3` if you used the venv above.

    PDFs ──batch.py──▶ beat grids ──batch2.py──▶ TTML ──build:ttml──▶ bundle ──▶ app
                                        ▲                                        │
                                   overrides.json ◀──────── you listen ──────────┘

### 1. Score PDFs → beat grids  (tool dir, ~40s for 920 hymns)

```bash
python3 batch.py imnuri-crestine --out /tmp/scores
```

Only `imnuri-crestine` has instrumentals, so only it is worth running; the other
five hymnals extract fine but there is no audio to align them to. Re-run this
only when stage 1 itself changes — editing overrides or stage 2 does not need it.

### 2. Beat grids + recordings → TTML  (tool dir, ~15 min for 841 hymns)

```bash
python3 batch2.py --scores /tmp/scores/imnuri-crestine --mp3 ../../mp3-source \
                  --out ../../assets/hymns --report /tmp/stage2.json
```

Writes straight into the app's TTML source directory, zero-padded (`004.ttml`)
to match the bundle keys `electron/hymnAssets.ts` looks up. Picks up
`overrides.json` automatically — pass `--overrides PATH` for a different file.

### 3. Review  (tool dir)

```bash
python3 report.py /tmp/stage2.json --scores /tmp/scores/imnuri-crestine
```

Ranks every hymn by confidence and prints the most and least trustworthy. See
**`margin` is the number to trust** below for what the numbers mean — and for
why none of them detect a hymn shifted bodily by one bar.

### 4. Bundle  (repo root)

```bash
npm run build:ttml
```

Collapses `assets/hymns/*.ttml` into `assets/hymns-ttml.json` (~5.9 MB for 841).

### 5. Test locally, without publishing  (repo root)

```bash
# install the new bundle where the app actually reads it
cp assets/hymns-ttml.json ~/Library/Application\ Support/bishub/hymns-ttml.json

# drop cached MP3s that differ from mp3-source, so the app re-fetches the
# canonical take the timings were generated against
CACHE=~/Library/Application\ Support/bishub/hymns/mp3
for f in "$CACHE"/*.mp3; do          # stat -f%z is macOS; use stat -c%s on Linux
  n=$(basename "$f")
  [ -f "mp3-source/$n" ] && [ "$(stat -f%z "$f")" != "$(stat -f%z "mp3-source/$n")" ] && rm "$f"
done

npm run electron:dev
```

Why this survives startup: the app ETag-checks the bundle against S3, sending the
ETag it stored last time it downloaded. That still matches whatever S3 holds, so
the check returns 304 and the cached *file* is never rewritten — your copy stays
put, while MP3 downloads keep working normally. No need to point the app at a
dead URL. (Deleting `hymns-ttml.etag` breaks this: with no ETag to send, the app
downloads S3's bundle and overwrites your copy.)

### 6. Publish, once it sounds right  (repo root)

```bash
npm run upload-assets -- --ttml     # bundle only; the MP3s on S3 are current
```

Outward-facing: this replaces the live assets for anyone running BisHub. The app
picks the new bundle up on next launch.

### Correcting what you hear

Easiest by ear, in the app — see **Correcting a hymn by ear** below, then
`npm run pull-lyric-tuning`. Or edit `overrides.json` directly (**Correcting a
hymn by hand**). Either way, repeat **only** steps 2, 4 and 5 afterwards; stage 1
is unaffected.

### Iterating on one hymn  (tool dir)

```bash
python3 extract.py imnuri-crestine 3 --out /tmp/s003.json          # stage 1
python3 stage2.py /tmp/s003.json ../../mp3-source/003.mp3 --out /tmp/g003.ttml
python3 compare.py /tmp/g003.ttml fixtures/003.ttml                # the one ground truth
```

Keyframes are implemented twice — `applyLyricsTuning` in TypeScript for the live
preview, `_word_deltas`/`to_ttml` in Python for the baked output — so there is a
check that they agree, which matters because a drift between them would sound
right while tuning and wrong once regenerated:

```bash
node check-tuning-parity.mjs /tmp/scores/imnuri-crestine/3.json ../../mp3-source/003.mp3
```

It also asserts words stay adjoining across a keyframe. The display animates
begin→end, so a gap freezes a word on screen and an overlap runs two at once;
a word's end therefore has to move with the word *after* it, not with itself.
It caught a real mismatch on its first run: a hand override was being re-snapped
onto nearby onsets by the generator, so a value tuned by ear did not survive
being baked in.

`compare.py` against `fixtures/003.ttml` is the regression test — run it after
any change to either stage. It should stay at rms ≈ 0.18s; if it moves, the
change cost accuracy somewhere. Stage 1 alone can also be checked with
`validate.py imnuri-crestine 3 fixtures/003.ttml`.

PDFs default to `~/Downloads/mybible/hymns/pdfs/<hymnal>/<number>.pdf`; override
with `--pdf-root`.

## Output

```jsonc
{
  "hymnal": "imnuri-crestine", "number": "102",
  "timeSignature": [2, 4], "beatsPerMeasure": 2.0, "beatUnit": "quarter",
  "melodyBeats": 30.0,
  // verses and chorus are separate passes of melody, each with its own length
  "sections": [{"kind": "verse", "startBeat": 0.0, "beats": 16.0, "rows": 4},
               {"kind": "chorus", "startBeat": 16.0, "beats": 14.0, "rows": 1}],
  "sequence": [0, 1, 2, 1, 3, 1, 4, 1],     // performance order, from the hymnal JSON
  "blocks": [{
    "index": 1, "kind": "verse", "section": "verse",
    "sectionBeats": 16.0,
    "textMatch": 1.0,                        // 1.0 = PDF lyrics matched the JSON exactly
    "lines": [{"text": "Prunc umil ni S-a născut", "beat": 0.0,
               "words": [{"text": "Prunc", "beat": 0.0}, {"text": "umil", "beat": 0.5}]}]
  }],
  "confidence": {"measuresChecked": 15, "measuresOk": 15, "score": 1.0,
                 "measuresCorrected": 0, "warnings": []}
}
```

Beats are quarter notes, **relative to the block's section**. A line marked
`"repeat": true` is a written-out musical repeat of an earlier line.

## How it works

`scoredoc.py` turns a PDF page into primitives. The embedded Emmentaler CFF
subsets keep their real glyph names, so noteheads, flags, rests, dots and clefs
are addressable by name; staff lines, stems, barlines, beams and lyric hyphens
are recovered from the drawing paths by shape.

`score.py` does the musical reading: staves → systems → note columns, durations,
lyric rows. `extract.py` assembles a whole hymn and aligns it to the shipped
hymnal JSON.

Three decisions carry most of the robustness:

- **Columns, not voices.** Everything sounding at one x is a column that lasts
  as long as its shortest note. Isolating the soprano would need voice
  separation, which breaks whenever a hymnal writes the upper parts as one
  stemmed chord instead of two voices.
- **Durations from differences.** A syllable lasts until the *next* syllable, so
  ties, slurs and melismas need no handling at all.
- **Words from the hymnal JSON, timing from the PDF.** LilyPond draws a real
  word-hyphen ("Plecați-vă") exactly like a syllable-break hyphen, so the PDF
  cannot spell words; the two letter streams are aligned instead.

Barlines double as ground truth: each measure is checked against the meter, and
`normalize_to_measures` rescales any measure that disagrees, so a single misread
note cannot drag the rest of the hymn out of place.

## Stage 2 — placing the score in the recording

`audio.py` decodes with the ffmpeg the repo already ships and computes a
spectral-flux onset curve in numpy; no librosa. `stage2.py` fits, then writes
TTML.

It does not beat-track the audio blind. It looks for the score's *own* pattern,
which pins tempo and intro offset down together, using two independent kinds of
evidence:

- **onsets** — a spectral-flux curve: does a note start here?
- **pitch** — a chromagram against the melody's own pitches: is that note
  sounding? Rhythm alone cannot place a tune whose notes are all the same
  length. Chroma also makes an octave slip in reading the clef free, and a
  twelve-way transposition match up front handles pianists who transpose for
  congregational range (hymn 003's recording is 10 semitones off the page).

Each verse and chorus is then placed on its own, so pauses between them and the
pianist's drift are absorbed locally, plus one hymn-wide parameter stretching
the fermatas the hymnal prints at phrase ends — hymn 001 holds ~1.5s per line,
thirty seconds across the hymn, which no tempo can absorb.

Candidates come from two sources. The opening phrase is searched directly, and
**structural** candidates are derived by working back from the end, since a
performance fills its recording. The second kind is what places strophic hymns:
their verses are musically identical, so verse 1's pattern fits verse 2's audio
just as well and the phrase search can miss the true entry outright.

After the first round of listening, two failures were reported and fixed:

- **A whole-bar slip.** The melody of bar N often fits bar N+1's audio nearly as
  well, so the winner can sit a bar early or late while every verse stays
  internally correct. In hymn 004 the three candidates one bar apart scored
  6.662 / 6.576 / 6.667 — and the one shipped was the *worst*, purely because no
  seed ever reached the best. Fixed by re-running the walk from the winner
  shifted by ±1 and ±2 bars. This is evidence-driven and robust: 004 lands on
  17.12 at every penalty setting tried.
- **The first verse alone misplaced** while the rest of the hymn is right, which
  is what the per-block walk recovering by block 2 looks like from the outside.
  Softened by the intro/tail asymmetry above, tuned to the mildest ratio that
  fixes it (hymn 313) without over-correcting elsewhere (hymn 195 collapses to a
  4.6s intro at 4.0/0.5). Unlike the bar shift this is a prior, not evidence.

Four approaches were tried and rejected; they are documented in the module so
they are not retried:

- One global (offset, tempo, per-verse pause) line — degenerate, because a
  slightly slow tempo imitates an accumulating pause.
- Free offset *and* tempo per line — overfits, scoring well on wrong alignments.
- Scoring candidates by raw correlation — rewards shorter patterns and locks
  onto double tempo. Mean evidence per note is scale-free and does not.
- **Matching the accompaniment as well as the melody**, on the theory that the
  harmony differs between bars even where the melody repeats. It made alignment
  clearly worse (hymn 003: rms 0.182s → 1.517s). Engraved horizontal spacing
  grows with the *logarithm* of a note's duration, so beats interpolated for
  notes between melody columns are wrong; and restricting to notes sharing a
  column instead only duplicates timing already present while blurring the
  chroma across a whole chord.

### `margin` is the number to trust

The intro is usually a phrase of the same tune, so the verse pattern genuinely
matches there too. Candidates are therefore played forward through the whole
performance and scored, and `margin` reports how far the winner beat a
genuinely different starting position.

A rhythmically uniform tune — every note a quarter — matches almost anywhere at
the right tempo. Pitch and the structural candidates now handle those (hymn 001
is 100% uniform and does align), but they stay the least certain cases, and a
low margin is the signal to check one by hand.

Margin is *relative*, so it is comparable within a run and not across runs that
search different numbers of candidates — adding the structural candidates lowered
margins across the board simply by adding plausible rivals.

**No aggregate metric here detects a whole-performance shift.** Sliding an entire
hymn by a bar leaves block spacing perfectly even, so the "first verse off-step"
count barely moves even when hundreds of hymns change position. Listening is the
only way to catch it; these numbers only rank what to listen to.

## Correcting a hymn by ear, in the app

Faster than editing JSON blind, and the only way to judge a correction honestly:
turn on **Settings → Timing tuning**, play a karaoke hymn, and a timing row
appears in the hymn transport bar. Nudges take effect on the projected display
immediately, so the right value is found in one playthrough rather than one
regenerate-and-listen cycle.

- **Offset** ±0.1s / ±0.5s shifts the whole hymn. This is the common case.
- **From here on** drops a keyframe at the word playing *now* and shifts it and
  every word after it, leaving everything earlier alone. Keyframes accumulate,
  so a later one adds to the ones before it, and nudging one back to zero
  removes it. Anchoring to the playhead rather than the slide means a hymn that
  drifts partway through a line can be corrected at exactly that word; the word
  a keyframe will attach to is shown beside the buttons.
- **Shift+←/→** nudges the playhead 0.1s, for the pause-then-tune workflow:
  stop on the word that drifts, land exactly on it, then drop the keyframe. The
  same pair appears as buttons either side of play/pause while tuning is on, so
  a phone remote can do it too.
- **Save correction** writes it to `lyric-tuning.json` in the app's user-data
  directory, where it is reapplied whenever that hymn loads.

Then fold the corrections back into the generator, from the repo root:

```bash
npm run pull-lyric-tuning     # userData/lyric-tuning.json -> overrides.json
```

Re-run steps 2, 4 and 5 of the runbook to bake them into the TTML. Until you do,
the corrections live only on the machine that made them.

Available from web remotes too, so you can tune from a phone while watching the
real projector.

## Correcting a hymn by hand

The automatic fit is right most of the time and wrong in ways no self-consistency
measure can detect: a hymn shifted by a whole bar leaves every internal check
perfectly happy. Chasing those with better priors hits diminishing returns fast —
each of four successive heuristics fixed one reported hymn and broke another —
so a listener's correction is recorded instead, in `overrides.json`:

```json
{
  "004": { "shift": 2.77, "note": "was a bar early" },
  "313": { "offset": 12.15 }
}
```

`shift` moves the result N seconds later (negative = earlier), which is usually
the easier judgement to make by ear. `offset` states where the first sung word
begins. The correction is applied after the fit and never second-guessed by it,
so it cannot be undone by later tuning. Re-run `batch2.py` to apply.

## A note on bundle size

The bundle is one JSON of every hymn — 841 hymns is ~5.9 MB, against 14 KB when
two were hand-timed. It ships inside the app and is re-downloaded whole whenever
it changes. Fine today; if OTA size becomes a problem the fix is per-hymn objects
rather than a single blob.

## Accuracy

**Stage 1**, against the two hand-timed TTMLs, fitting offset + tempo (+ a
per-verse breath):

| hymn | words | rms | max |
|---|---|---|---|
| 001 | 73/73 exact | 0.237s | 0.789s |
| 003 | 118/118 exact | 0.212s | 0.517s |

**Stage 2**, fully automatic, generated TTML vs the hand-timed one.
`assets/hymns/003.ttml` is the only usable ground truth: 001 was timed against a
recording that has since been replaced, so it can no longer be scored.

| hymn | rms | within 0.3s | within 0.5s | max |
|---|---|---|---|---|
| 003 | **0.180s** | 95% | 100% | 0.476s |

Over 150 hymns against `mp3-source`: **97%** produce an alignment that uses the
recording sensibly (a short intro and tail, nothing abandoned), up from 91%
before pitch and structural candidates. ~5.4s per hymn per core, so the full 920
takes about ten minutes on twelve cores.

With a single ground truth these corpus figures are self-consistency proxies,
not accuracy. Calibrating them needs a spot-check of a sample in the app.

Across all 1239 hymns that have engraved music:

| | count | share |
|---|---|---|
| every verse aligned and timed | 998 | 80.5% |
| all measures check out | 795 | 64.2% |
| fully clean (both, exact text) | 545 | 44.0% |

Use `confidence.score`, `confidence.warnings` and `textMatch` to pick the hymns
that need a human look. `batch.py --report` writes the whole survey as JSON.
